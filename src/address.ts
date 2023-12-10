import RLP from 'rlp'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { keccak256 } from 'web3-utils'

const toXOnly = (pubKey: Buffer) => (pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33))
bitcoin.initEccLib(ecc)

const publicKeyToAddress = (publicKeyHex: string, networkType: 'mainnet' | 'testnet' = 'mainnet') => {
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex')
  const network = networkType === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet

  // p2tr
  const tapInternalKey = toXOnly(publicKeyBuffer)

  return {
    p2tr: bitcoin.payments.p2tr({ internalPubkey: tapInternalKey, network }).address!,
    p2pkh: bitcoin.payments.p2pkh({ pubkey: publicKeyBuffer, network }).address!,
    p2sh: bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: publicKeyBuffer, network }),
    }).address!,
    p2wpkh: bitcoin.payments.p2wpkh({ pubkey: publicKeyBuffer, network }).address!,
  }
}

const generateHexAddress = (address: string) => {
  return '0x' + keccak256(address).slice(26)
}

const generateContractAddress = (walletAddress: string, nonce: number) => {
  const input = RLP.encode([walletAddress, nonce])
  const hash = keccak256(input)

  return '0x' + hash.slice(26)
}

export default {
  publicKeyToAddress,
  generateHexAddress,
  generateContractAddress,
}

export {
  publicKeyToAddress,
  generateHexAddress,
  generateContractAddress,
}