/** Password hashing contract — implemented with bcrypt in infrastructure. */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
