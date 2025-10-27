import { NextFunction, Request, Response } from "express";
import { UserService } from "../services/userService";
import { JwtPayload, JwtService } from "../utils/jwt";

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface AuthRequest extends Request {
  user: JwtPayload;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        error: "Access denied. No token provided.",
      });
      return;
    }

    // Verify token
    const decoded = JwtService.verifyToken(token);

    // Verify user still exists and is active
    const user = await UserService.getUserById(decoded.userId);
    if (!user || !user.is_active) {
      res.status(401).json({
        error: "Access denied. Invalid user.",
      });
      return;
    }

    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: "Access denied. Invalid token.",
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = JwtService.verifyToken(token);
      const user = await UserService.getUserById(decoded.userId);

      if (user && user.is_active) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
