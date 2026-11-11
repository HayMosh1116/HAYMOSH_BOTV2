const DEFAULT_MAX_MESSAGES = 10000;
const DEFAULT_MAX_CHATS = 5000;
const DEFAULT_MAX_CONTACTS = 10000;

function positiveLimit(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

class gmdStore {
  constructor(options = {}) {
    this.messages = new Map();
    this.byId = new Map();
    this.messageOrder = new Map();
    this.contacts = new Map();
    this.chats = new Map();
    this.maxMessages = positiveLimit(options.maxMessages, DEFAULT_MAX_MESSAGES);
    this.maxChats = positiveLimit(options.maxChats, DEFAULT_MAX_CHATS);
    this.maxContacts = positiveLimit(options.maxContacts, DEFAULT_MAX_CONTACTS);
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    this.cleanupInterval.unref?.();
  }

  _messageOrderKey(jid, id) {
    return JSON.stringify([jid, id]);
  }

  _evictMessage(orderKey, entry) {
    this.messageOrder.delete(orderKey);
    const chatMessages = this.messages.get(entry.jid);
    const oldMessage = chatMessages?.get(entry.id);
    chatMessages?.delete(entry.id);
    if (oldMessage && this.byId.get(entry.id) === oldMessage) {
      this.byId.delete(entry.id);
    }
    if (chatMessages && chatMessages.size === 0) this.messages.delete(entry.jid);
  }

  _evictOldestChat() {
    const jid = this.messages.keys().next().value;
    if (jid === undefined) return;
    const chatMessages = this.messages.get(jid);
    for (const [id, message] of chatMessages || []) {
      this.messageOrder.delete(this._messageOrderKey(jid, id));
      if (this.byId.get(id) === message) this.byId.delete(id);
    }
    this.messages.delete(jid);
  }

  _setBounded(map, key, value, limit) {
    if (key === undefined || key === null || key === "") return;
    map.delete(key);
    map.set(key, value);
    while (map.size > limit) map.delete(map.keys().next().value);
  }

  loadMessage(jid, id) {
    const chatMessages = this.messages.get(String(jid || ""));
    const direct = chatMessages?.get(String(id || ""));
    if (direct) return direct;
    // WhatsApp retry requests can use a LID/device-suffixed JID.
    return this.byId.get(String(id || "")) || null;
  }

  saveMessage(jid, message) {
    const normalizedJid = String(jid || "");
    const id = String(message?.key?.id || "");
    if (!normalizedJid || !id) return;

    let chatMessages = this.messages.get(normalizedJid);
    if (!chatMessages) chatMessages = new Map();
    const orderKey = this._messageOrderKey(normalizedJid, id);
    this.messageOrder.delete(orderKey);
    chatMessages.set(id, message);
    this.byId.set(id, message);
    this.messageOrder.set(orderKey, { jid: normalizedJid, id });

    // Touch the chat so maxChats behaves as an LRU cap too.
    this.messages.delete(normalizedJid);
    this.messages.set(normalizedJid, chatMessages);

    while (this.messageOrder.size > this.maxMessages) {
      const oldestKey = this.messageOrder.keys().next().value;
      this._evictMessage(oldestKey, this.messageOrder.get(oldestKey));
    }
    while (this.messages.size > this.maxChats) this._evictOldestChat();
  }

  setChat(chat) {
    if (chat?.id) this._setBounded(this.chats, chat.id, chat, this.maxChats);
  }

  setContact(contact) {
    if (contact?.id) this._setBounded(this.contacts, contact.id, contact, this.maxContacts);
  }

  cleanup() {
    try {
      while (this.messageOrder.size > this.maxMessages) {
        const oldestKey = this.messageOrder.keys().next().value;
        this._evictMessage(oldestKey, this.messageOrder.get(oldestKey));
      }
      while (this.messages.size > this.maxChats) this._evictOldestChat();
      while (this.chats.size > this.maxChats) this.chats.delete(this.chats.keys().next().value);
      while (this.contacts.size > this.maxContacts) this.contacts.delete(this.contacts.keys().next().value);
    } catch (error) {
      console.error("Store cleanup error:", error);
    }
  }

  bind(ev) {
    ev.on("messages.upsert", ({ messages = [] } = {}) => {
      for (const msg of messages) {
        if (msg.key?.remoteJid && msg.key?.id) this.saveMessage(msg.key.remoteJid, msg);
      }
    });
    ev.on("chats.set", ({ chats = [] } = {}) => {
      for (const chat of chats) this.setChat(chat);
    });
    ev.on("contacts.set", ({ contacts = [] } = {}) => {
      for (const contact of contacts) this.setContact(contact);
    });
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.messages.clear();
    this.byId.clear();
    this.messageOrder.clear();
    this.contacts.clear();
    this.chats.clear();
  }
}

module.exports = { gmdStore };
