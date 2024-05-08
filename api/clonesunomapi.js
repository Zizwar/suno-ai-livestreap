


class SunoApi {
  static BASE_URL = 'https://studio-api.suno.ai';
  static CLERK_BASE_URL = 'https://clerk.suno.com';

  constructor(cookie) {
    this.cookie = cookie;
    this.sid = undefined;
    this.currentToken = undefined;
  }

  async init() {
    await this.getAuthToken();
    await this.keepAlive();
    return this;
  }

  async getAuthToken() {
    const getSessionUrl = `${SunoApi.CLERK_BASE_URL}/v1/client?_clerk_js_version=4.72.1`;
    const sessionResponse = await this.fetchData(getSessionUrl);
    const sessionData = await sessionResponse.json();
    if (!sessionData?.response?.['last_active_session_id']) {
      throw new Error("Failed to get session id, you may need to update the SUNO_COOKIE");
    }
    this.sid = sessionData.response['last_active_session_id'];
  }

  async keepAlive(isWait) {
    if (!this.sid) {
      throw new Error("Session ID is not set. Cannot renew token.");
    }
    const renewUrl = `${SunoApi.CLERK_BASE_URL}/v1/client/sessions/${this.sid}/tokens?_clerk_js_version=4.72.0-snapshot.vc141245`;
    const renewResponse = await this.fetchData(renewUrl, { method: 'POST' });
    console.info("KeepAlive...\n");
    if (isWait) {
      await this.sleep(1, 2);
    }
    const newToken = await renewResponse.json();
    this.currentToken = newToken['jwt'];
  }

  async fetchData(url, options) {
    const headers = {
      'User-Agent': this.generateRandomUserAgent(),
      'Cookie': this.cookie
    };
    const requestOptions = {
      ...options,
      headers: {
        ...options?.headers,
        ...headers
      }
    };
    return await fetch(url, requestOptions);
  }

  generateRandomUserAgent() {
    const uaStrings = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      // Add more user agent strings if needed
    ];
  
    return uaStrings[Math.floor(Math.random() * uaStrings.length)];
  }

  async generateLyrics(prompt) {
    await this.keepAlive(false);
    const generateResponse = await this.fetchData(`${SunoApi.BASE_URL}/api/generate/lyrics/`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
      headers: { 'Content-Type': 'application/json' }
    });
    const generateData = await generateResponse.json();
    const generateId = generateData.id;

    let lyricsResponse = await this.fetchData(`${SunoApi.BASE_URL}/api/generate/lyrics/${generateId}`);
    let lyricsData = await lyricsResponse.json();
    while (lyricsData?.status !== 'complete') {
      await this.sleep(2);
      lyricsResponse = await this.fetchData(`${SunoApi.BASE_URL}/api/generate/lyrics/${generateId}`);
      lyricsData = await lyricsResponse.json();
    }

    return lyricsData;
  }

  async sleep(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

const newSunoApi = async (cookie) => {
  const sunoApi = new SunoApi(cookie);
  return await sunoApi.init();
}

if (!process.env.SUNO_COOKIE) {
  console.log("Environment does not contain SUNO_COOKIE.", process.env)
}

const sunoApi = newSunoApi(process.env.SUNO_COOKIE || '');

// Example usage of generateLyrics function
async function getLyrics(prompt) {
  try {
    // Call the generateLyrics function with the prompt
    const lyrics = await sunoApi.generateLyrics(prompt);
    console.log("Generated Lyrics:", lyrics);
  } catch (error) {
    console.error("Error generating lyrics:", error);
  }
}

// Example usage
const prompt = "Write a prompt here to generate lyrics...";
getLyrics(prompt);
