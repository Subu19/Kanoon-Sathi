import jwt from "jsonwebtoken";
import { env } from "./env_validator";

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

export class JwtService {
  private static readonly SECRET = env.JWT_SECRET || "your-secret-key";
  private static readonly EXPIRES_IN = "7d";

  /**
   * Generate a JWT token for a user
   */
  static generateToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: this.EXPIRES_IN,
    });
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.SECRET) as JwtPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.substring(7);
  }
}
