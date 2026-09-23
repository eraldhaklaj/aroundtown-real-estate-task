import type { User } from "../types.js";

// Hard-coded demo accounts. Passwords are stored only as bcrypt hashes;
// the plaintext demo credentials are documented in the README.
export const users: User[] = [
  {
    id: "u-buyer-1",
    email: "buyer@demo.com",
    name: "Sam Becker",
    role: "user",
    passwordHash: "$2b$10$JiYqLRjWMTHGoWJnqBEHUeLMm756zJsdrioFkOSPggkG8YxjCZo7m", // password123
  },
  {
    id: "u-agent-1",
    email: "agent@demo.com",
    name: "Alex Wagner",
    role: "agent",
    passwordHash: "$2b$10$JiYqLRjWMTHGoWJnqBEHUeLMm756zJsdrioFkOSPggkG8YxjCZo7m", // password123
  },
];

export function findUserByEmail(email: string) {
  return users.find((u) => u.email === email.toLowerCase());
}

export function findUserById(id: string) {
  return users.find((u) => u.id === id);
}
