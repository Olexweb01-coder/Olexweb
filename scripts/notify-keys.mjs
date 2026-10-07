// npm run notify:keys: creates the two keys Olex AI notifications need. Add the printed lines to .env.local and Vercel.
import webpush from 'web-push'
const k = webpush.generateVAPIDKeys()
console.log('Add these two lines to .env.local (and to Vercel, all three environments):\n')
console.log('VAPID_PUBLIC_KEY=' + k.publicKey)
console.log('VAPID_PRIVATE_KEY=' + k.privateKey)
console.log('\nKeep VAPID_PRIVATE_KEY secret. Create them once: new keys would switch off notifications on every device.')
