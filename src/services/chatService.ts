import Database from "../utils/db";

export interface Chat {
  id: string;
  user_id: string;
  title?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  chat_id: string;
  sender: "user" | "model" | "system";
  content: string;
  created_at: Date;
}

export interface CreateChatRequest {
  title?: string;
}

export interface SendMessageRequest {
  content: string;
  sender: "user" | "model" | "system";
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

export interface ChatListItem extends Chat {
  lastMessage?: Message;
  messageCount: number;
}

export class ChatService {
  /**
   * Create a new chat for a user
   */
  static async createChat(userId: string, chatData: CreateChatRequest): Promise<Chat> {
    const { title } = chatData;

    const result = await Database.query(
      `INSERT INTO chats (user_id, title) 
       VALUES ($1, $2) 
       RETURNING id, user_id, title, created_at, updated_at`,
      [userId, title || null],
    );

    return result.rows[0];
  }

  /**
   * Get all chats for a user with their last message
   */
  static async getUserChats(userId: string, limit = 50, offset = 0): Promise<ChatListItem[]> {
    const result = await Database.query(
      `SELECT 
        c.id, c.user_id, c.title, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count,
        m.id as last_message_id,
        m.sender as last_message_sender,
        m.content as last_message_content,
        m.created_at as last_message_created_at
       FROM chats c
       LEFT JOIN LATERAL (
         SELECT id, sender, content, created_at
         FROM messages 
         WHERE chat_id = c.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) m ON true
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      messageCount: parseInt(row.message_count, 10),
      lastMessage: row.last_message_id
        ? {
            id: row.last_message_id,
            chat_id: row.id,
            sender: row.last_message_sender,
            content: row.last_message_content,
            created_at: row.last_message_created_at,
          }
        : undefined,
    }));
  }

  /**
   * Get a specific chat by ID (with ownership check)
   */
  static async getChatById(chatId: string, userId: string): Promise<Chat | null> {
    const result = await Database.query(
      "SELECT id, user_id, title, created_at, updated_at FROM chats WHERE id = $1 AND user_id = $2",
      [chatId, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get chat with all messages
   */
  static async getChatWithMessages(
    chatId: string,
    userId: string,
  ): Promise<ChatWithMessages | null> {
    // First verify chat ownership
    const chat = await this.getChatById(chatId, userId);
    if (!chat) {
      return null;
    }

    // Get all messages for this chat
    const messagesResult = await Database.query(
      "SELECT id, chat_id, sender, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC",
      [chatId],
    );

    return {
      ...chat,
      messages: messagesResult.rows,
    };
  }

  /**
   * Add a message to a chat
   */
  static async addMessage(
    chatId: string,
    userId: string,
    messageData: SendMessageRequest,
  ): Promise<Message> {
    // Verify chat ownership
    const chat = await this.getChatById(chatId, userId);
    if (!chat) {
      throw new Error("Chat not found or access denied");
    }

    const { content, sender } = messageData;

    await Database.query("BEGIN");
    try {
      // Insert message
      const messageResult = await Database.query(
        `INSERT INTO messages (chat_id, sender, content) 
         VALUES ($1, $2, $3) 
         RETURNING id, chat_id, sender, content, created_at`,
        [chatId, sender, content],
      );

      // Update chat's updated_at timestamp
      await Database.query("UPDATE chats SET updated_at = NOW() WHERE id = $1", [chatId]);

      await Database.query("COMMIT");

      return messageResult.rows[0];
    } catch (error) {
      await Database.query("ROLLBACK");
      throw error;
    }
  }

  /**
   * Update chat title
   */
  static async updateChatTitle(chatId: string, userId: string, title: string): Promise<Chat> {
    const result = await Database.query(
      `UPDATE chats SET title = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3 
       RETURNING id, user_id, title, created_at, updated_at`,
      [title, chatId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("Chat not found or access denied");
    }

    return result.rows[0];
  }

  /**
   * Delete a chat and all its messages
   */
  static async deleteChat(chatId: string, userId: string): Promise<void> {
    await Database.query("BEGIN");
    try {
      // Verify ownership before deletion
      const chat = await this.getChatById(chatId, userId);
      if (!chat) {
        throw new Error("Chat not found or access denied");
      }

      // Delete messages first (due to foreign key constraint)
      await Database.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);

      // Delete chat
      await Database.query("DELETE FROM chats WHERE id = $1", [chatId]);

      await Database.query("COMMIT");
    } catch (error) {
      await Database.query("ROLLBACK");
      throw error;
    }
  }

  /**
   * Get messages for a chat with pagination
   */
  static async getChatMessages(
    chatId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<Message[]> {
    // Verify chat ownership
    const chat = await this.getChatById(chatId, userId);
    if (!chat) {
      throw new Error("Chat not found or access denied");
    }

    const result = await Database.query(
      `SELECT id, chat_id, sender, content, created_at 
       FROM messages 
       WHERE chat_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [chatId, limit, offset],
    );

    // Return in chronological order (oldest first)
    return result.rows.reverse();
  }
}
