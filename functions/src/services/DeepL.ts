import axios from 'axios'

/**
 * Yo
 */
export default class DeepL {
  key: string

  /**
     * Whatever
     * @param {string} key The first text
     */
  constructor(key: string) {
    this.key = key
  }

  /**
     * Whatever
     * @param {string} text The first text
     * @param {string} target The first text
     */
  async translate(text:string, target:string) {
    const params = new URLSearchParams({
      text: text,
      target_lang: target,
    })

    const result = await axios.post('https://api-free.deepl.com/v2/translate', params, {
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.key}`,
      },
    })
    if (result.status !== 200) {
      throw result
    }
    const translation = result.data.translations[0]
    return translation.text
  }
}

type SUPPORTED_LANGUAGE = 'en' | 'ja' | 'vn';

export const TARGET_LANGUAGES: { [key: string]: SUPPORTED_LANGUAGE } = {
  'english': 'en',
  'japanese': 'ja',
  'vietnamese': 'vn',
}
