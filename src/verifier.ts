import { verify } from 'bitcoinjs-message'
import { Verifier } from 'bip322-js'

const verifyMessage = (
  message: string,
  signature: string,
  address: string,
  type: 'ecdsa' | 'bip-322' = 'ecdsa'
) => {
  switch (type) {
    case 'bip-322':
      return Verifier.verifySignature(address, message, signature)
    case 'ecdsa':
    default:
      return verify(message, address, signature)
  }
}

export default verifyMessage