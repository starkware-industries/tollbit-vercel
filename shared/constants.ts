export const DEFAULT_ORIGIN_PORT = 5173;
export const DEFAULT_TOLLBOOTH_PORT = 5174;
export const MICROS_PER_UNIT = 1_000_000;
export const TOKEN_TTL_SECONDS = 300;
export const TRAFFIC_LOG_LIMIT = 200;
export const LEDGER_LIMIT = 500;
export const MICRO_PRICE_PRECISION_THRESHOLD = 0.01;

export const TOLLBIT_GATEWAY_URL = 'https://gateway.tollbit.com';
export const TOKEN_PATH_CONTENT = '/tollbit/dev/v2/tokens/content';
export const TOKEN_PATH_CRAWL = '/tollbit/dev/v2/tokens/crawl';
export const RATES_PATH = '/tollbit/dev/v2/rates';

export const TOKEN_HEADER = 'tollbit-token';
export const KEY_HEADER = 'tollbitkey';
export const ACCEPT_CONTENT_HEADER = 'tollbit-accept-content';
export const BOT_MATCH_HEADER = 'x-playground-bot';

/** Internal routes the tollbooth uses to pull structured content from the origin. */
export const ORIGIN_CONTENT_PATH = '/__origin/content';
export const ORIGIN_CATALOG_PATH = '/__origin/catalog';

/** Playground assumption: TollBit's real revenue share is set in your contract. */
export const DEFAULT_FEE_BPS = 2000;
export const BPS_DIVISOR = 10_000;

export const HTTP_PAYMENT_REQUIRED = 402;
export const HTTP_FOUND = 302;
export const HTTP_OK = 200;

/**
 * Vercel serves static assets only from public/**, and ignores express.static. The built
 * shell is moved out of public/ so page requests reach the function and get real article
 * HTML injected instead of the CDN handing back an empty SPA shell.
 */
export const CLIENT_ASSET_DIR = 'public';

export const TOLLBIT_PUBLISHER_DASHBOARD = 'https://app.tollbit.com';

export const DEFAULT_AGENT_USER_AGENT = 'GPTBot/1.0 (+tollbit-playground)';
export const DEFAULT_MAX_PRICE_MICROS = 1_000_000;
export const DEV_TOLLBIT_KEY = 'playground-dev-key';
