import * as admin from 'firebase-admin'

export default class FirebasePersistence {
  admin: typeof admin

  constructor(databaseUrl: string) {
    admin.initializeApp({databaseURL: databaseUrl})
    this.admin = admin
  }

  async select<T>(key: string): Promise<T> {
    const snapshot = await admin.database().ref(key).once('value')
    return snapshot.val()
  }

  async upsert<T>(key: string, value: T) {
    await admin.database().ref(key).set(value)
  }
}
