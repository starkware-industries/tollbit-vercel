import { SignJWT, jwtVerify } from 'jose';
import { TOKEN_TTL_SECONDS } from '../../shared/constants';

export type TokenType = 'content' | 'crawl';

export type TollbitClaims = {
  iss: string;
  sub: string;
  aud: string;
  tt: TokenType;
  x: {
    ua: string;
    aid: string;
    mpm?: number;
    cur?: string;
    lt?: string;
  };
};

export type MintInput = {
  url: string;
  userAgent: string;
  agentId: string;
  audience: string;
  tokenType: TokenType;
  maxPriceMicros?: number;
  currency?: string;
  licenseType?: string;
};

const ISSUER = 'mock-gateway.tollbit.local';
const DEV_SECRET = 'tollbit-playground-mock-secret';
const ALGORITHM = 'HS256';

export async function mintToken(input: MintInput): Promise<string> {
  return new SignJWT({
    tt: input.tokenType,
    x: {
      ua: input.userAgent,
      aid: input.agentId,
      mpm: input.maxPriceMicros,
      cur: input.currency,
      lt: input.licenseType,
    },
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setSubject(input.url)
    .setAudience(input.audience)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyToken(
  token: string,
  audience: string,
): Promise<TollbitClaims> {
  const { payload } = await jwtVerify(token, secret(), {
    issuer: ISSUER,
    audience,
  });
  return payload as unknown as TollbitClaims;
}

export function tokenTtlSeconds(): number {
  return TOKEN_TTL_SECONDS;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.MOCK_TOLLBIT_SECRET ?? DEV_SECRET);
}
