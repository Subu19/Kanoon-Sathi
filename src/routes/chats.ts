import express, { Request, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { ChatService, CreateChatRequest, SendMessageRequest } from "../services/chatService";

const router = express.Router();

/**
 * GET /api/chats
 * Get all chats for the authenticated user
 */
router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { limit = 50, offset = 0 } = req.query;

    const chats = await ChatService.getUserChats(
      authReq.user.userId,
      Number(limit),
      Number(offset),
    );

    res.json({
      data: chats,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: chats.length,
      },
    });
  } catch (error) {
    console.error("Get chats error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/chats
 * Create a new chat
 */
router.post("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { title }: CreateChatRequest = req.body;

    const chat = await ChatService.createChat(authReq.user.userId, { title });

    res.status(201).json({
      message: "Chat created successfully",
      data: chat,
    });
  } catch (error) {
    console.error("Create chat error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/chats/:chatId
 * Get a specific chat with all messages
 */
router.get("/:chatId", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { chatId } = req.params;

    const chat = await ChatService.getChatWithMessages(chatId, authReq.user.userId);

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    res.json({
      data: chat,
    });
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * PUT /api/chats/:chatId
 * Update chat title
 */
router.put("/:chatId", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { chatId } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== "string") {
      res.status(400).json({
        error: "Title is required and must be a string",
      });
      return;
    }

    if (title.length > 255) {
      res.status(400).json({
        error: "Title must be less than 255 characters",
      });
      return;
    }

    const updatedChat = await ChatService.updateChatTitle(chatId, authReq.user.userId, title);

    res.json({
      message: "Chat title updated successfully",
      data: updatedChat,
    });
  } catch (error) {
    console.error("Update chat error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * DELETE /api/chats/:chatId
 * Delete a chat and all its messages
 */
router.delete("/:chatId", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { chatId } = req.params;

    await ChatService.deleteChat(chatId, authReq.user.userId);

    res.json({
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Delete chat error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/chats/:chatId/messages
 * Get messages for a specific chat with pagination
 */
router.get(
  "/:chatId/messages",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const { chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const messages = await ChatService.getChatMessages(
        chatId,
        authReq.user.userId,
        Number(limit),
        Number(offset),
      );

      res.json({
        data: messages,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: messages.length,
        },
      });
    } catch (error) {
      console.error("Get chat messages error:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

/**
 * POST /api/chats/:chatId/messages
 * Add a new message to a chat
 */
router.post(
  "/:chatId/messages",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const { chatId } = req.params;
      const { content, sender = "user" }: SendMessageRequest = req.body;

      // Validation
      if (!content || typeof content !== "string") {
        res.status(400).json({
          error: "Content is required and must be a string",
        });
        return;
      }

      if (content.length > 10000) {
        res.status(400).json({
          error: "Message content must be less than 10000 characters",
        });
        return;
      }

      if (!["user", "model", "system"].includes(sender)) {
        res.status(400).json({
          error: "Sender must be one of: user, model, system",
        });
        return;
      }

      const message = await ChatService.addMessage(chatId, authReq.user.userId, {
        content,
        sender,
      });

      res.status(201).json({
        message: "Message added successfully",
        data: message,
      });
    } catch (error) {
      console.error("Add message error:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

export default router;
