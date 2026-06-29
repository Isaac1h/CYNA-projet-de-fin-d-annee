export type ContactMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  content: string;
};
