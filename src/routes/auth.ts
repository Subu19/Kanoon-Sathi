import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { CreateUserRequest, LoginRequest, UserService } from "../services/userService";

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post("/register", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, email }: CreateUserRequest = req.body;

    // Validation
    if (!username || !password) {
      res.status(400).json({
        error: "Username and password are required",
      });
      return;
    }

    if (username.length < 3 || username.length > 50) {
      res.status(400).json({
        error: "Username must be between 3 and 50 characters",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
      return;
    }

    // Email validation (if provided)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        error: "Invalid email format",
      });
      return;
    }

    const result = await UserService.createUser({ username, password, email });

    res.status(201).json({
      message: "User created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        res.status(409).json({ error: error.message });
        return;
      }
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post("/login", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password }: LoginRequest = req.body;

    // Validation
    if (!username || !password) {
      res.status(400).json({
        error: "Username and password are required",
      });
      return;
    }

    const result = await UserService.loginUser({ username, password });

    res.json({
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof Error && error.message.includes("Invalid username or password")) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get("/me", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const user = await UserService.getUserById(authReq.user.userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      data: user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put("/profile", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { username, email } = req.body;

    // Validation
    if (username && (username.length < 3 || username.length > 50)) {
      res.status(400).json({
        error: "Username must be between 3 and 50 characters",
      });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        error: "Invalid email format",
      });
      return;
    }

    const updatedUser = await UserService.updateUser(authReq.user.userId, { username, email });

    res.json({
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error instanceof Error && error.message.includes("already exists")) {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * DELETE /api/auth/account
 * Delete user account (soft delete)
 */
router.delete("/account", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    await UserService.deleteUser(authReq.user.userId);

    res.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
