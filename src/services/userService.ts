import bcrypt from "bcryptjs";
import Database from "../utils/db";
import { JwtService } from "../utils/jwt";

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: Date;
  last_login?: Date;
  is_active: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, "password_hash">;
  token: string;
}

export class UserService {
  /**
   * Create a new user account
   */
  static async createUser(userData: CreateUserRequest): Promise<AuthResponse> {
    const { username, password, email } = userData;

    // Check if username already exists
    const existingUser = await Database.query("SELECT id FROM users WHERE username = $1", [
      username,
    ]);

    if (existingUser.rows.length > 0) {
      throw new Error("Username already exists");
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await Database.query("SELECT id FROM users WHERE email = $1", [email]);

      if (existingEmail.rows.length > 0) {
        throw new Error("Email already exists");
      }
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await Database.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at, last_login, is_active`,
      [username, email || null, passwordHash],
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = JwtService.generateToken({
      userId: user.id,
      username: user.username,
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        last_login: user.last_login,
        is_active: user.is_active,
      },
      token,
    };
  }

  /**
   * Authenticate user login
   */
  static async loginUser(loginData: LoginRequest): Promise<AuthResponse> {
    const { username, password } = loginData;

    // Find user by username
    const result = await Database.query(
      "SELECT id, username, email, password_hash, created_at, last_login, is_active FROM users WHERE username = $1 AND is_active = true",
      [username],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid username or password");
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid username or password");
    }

    // Update last login
    await Database.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

    // Generate JWT token
    const token = JwtService.generateToken({
      userId: user.id,
      username: user.username,
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        last_login: new Date(),
        is_active: user.is_active,
      },
      token,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const result = await Database.query(
      "SELECT id, username, email, created_at, last_login, is_active FROM users WHERE id = $1 AND is_active = true",
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update user profile
   */
  static async updateUser(
    userId: string,
    updates: Partial<Pick<CreateUserRequest, "username" | "email">>,
  ): Promise<User> {
    const { username, email } = updates;

    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (username) {
      // Check if new username is available
      const existingUser = await Database.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, userId],
      );

      if (existingUser.rows.length > 0) {
        throw new Error("Username already exists");
      }

      setParts.push(`username = $${paramIndex++}`);
      values.push(username);
    }

    if (email) {
      // Check if new email is available
      const existingEmail = await Database.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, userId],
      );

      if (existingEmail.rows.length > 0) {
        throw new Error("Email already exists");
      }

      setParts.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    if (setParts.length === 0) {
      throw new Error("No updates provided");
    }

    values.push(userId);

    const result = await Database.query(
      `UPDATE users SET ${setParts.join(", ")} WHERE id = $${paramIndex} 
       RETURNING id, username, email, created_at, last_login, is_active`,
      values,
    );

    return result.rows[0];
  }

  /**
   * Delete user account (soft delete)
   */
  static async deleteUser(userId: string): Promise<void> {
    await Database.query("UPDATE users SET is_active = false WHERE id = $1", [userId]);
  }
}
