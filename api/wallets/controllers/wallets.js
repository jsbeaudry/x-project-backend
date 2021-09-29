"use strict";

// const { sanitizeEntity } = require("strapi-utils");
// const web3 = require("@solana/web3.js");
// const splToken = require("@solana/spl-token");
// const bip39 = require("bip39");
// const nacl = require("tweetnacl");

// const Cryptr = require("cryptr");
// const cryptr = new Cryptr(process.env.SECRETKEY);

// const connection = new web3.Connection(
//   web3.clusterApiUrl("testnet"),
//   "confirmed"
// );

// const regenerateSeedPhrase = () => {
//   const phrase = bip39.generateMnemonic();
//   return phrase;
// };
// const createAccountFromMnemonic = async (mnemonic) => {
//   const seed = await bip39.mnemonicToSeed(mnemonic);
//   const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
//   const wallet = new web3.Account(keyPair.secretKey);

//   const account = {
//     keyPair,
//     wallet,
//   };
//   return await account;
// };
// const validateRecoverPhrase = (phrase) => {
//   if (phrase) {
//     if (bip39.validateMnemonic(phrase)) {
//       return "success";
//     } else {
//       return "error";
//     }
//   }
//   return null;
// };

// const sendSlpToken = async (phrase, walletTo, tokenId, amount, digit) => {
//   const uncrypt = cryptr.decrypt(phrase);
//   const seed = await bip39.mnemonicToSeed(uncrypt);

//   const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
//   // console.log(keyPair.secretKey);
//   const fromWallet = new web3.Account(keyPair.secretKey);
//   const keyTokenId = new web3.PublicKey(tokenId);
//   const receiver = new web3.PublicKey(walletTo);

//   try {
//     // Load new token mint
//     const token = new splToken.Token(
//       connection,
//       keyTokenId,
//       splToken.TOKEN_PROGRAM_ID,
//       fromWallet
//     );

//     // Create associated token accounts for my token if they don't exist yet
//     var fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(
//       fromWallet.publicKey
//     );
//     var receiverTokenAccount = await token.getOrCreateAssociatedAccountInfo(
//       receiver
//     );

//     console.log("publicKey", token.publicKey.toString());
//     console.log("programId", token.programId.toString());
//     console.log("associatedProgramId", token.associatedProgramId.toString());
//     console.log("payer", token.payer.publicKey.toString());

//     // Add token transfer instructions to transaction
//     var transaction = new web3.Transaction({
//       // feePayer: receiverTokenAccount.address,
//     }).add(
//       splToken.Token.createTransferInstruction(
//         splToken.TOKEN_PROGRAM_ID,
//         fromTokenAccount.address,
//         receiverTokenAccount.address,
//         fromWallet.publicKey,
//         [],
//         amount * 1000000
//       )
//     );
//     console.log(transaction);
//     // Sign transaction, broadcast, and confirm
//     var signature = await web3.sendAndConfirmTransaction(
//       connection,
//       transaction,
//       [fromWallet]
//     );

//     return { succes: true, signature: signature };
//   } catch (err) {
//     return { succes: false, err: err };
//   }
// };
// const mintSlpToken = async (phrase, walletTo, tokenId, amount) => {
//   const seed = await bip39.mnemonicToSeed(phrase);

//   const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
//   const fromWallet = new web3.Account(keyPair.secretKey);
//   const keyTokenId = new web3.PublicKey(tokenId);
//   const receiver = new web3.PublicKey(walletTo);

//   try {
//     // Load new token mint
//     const token = new splToken.Token(
//       connection,
//       keyTokenId,
//       splToken.TOKEN_PROGRAM_ID,
//       fromWallet
//     );

//     // Create associated token accounts for my token if they don't exist yet
//     var fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(
//       fromWallet.publicKey
//     );
//     var receiverTokenAccount = await token.getOrCreateAssociatedAccountInfo(
//       receiver
//     );

//     // Minting 1 new token to the "fromTokenAccount" account we just returned/created
//     let res = await token.mintTo(
//       receiverTokenAccount.address,
//       fromWallet.publicKey,
//       [],
//       amount * 1000000000
//     );

//     console.log(res);
//     return { succes: true };
//   } catch (err) {
//     return { succes: false, err: err };
//   }
// };
// const sendSolToken = async (mnemonic, receiver, amount) => {
//   const seed = await bip39.mnemonicToSeed(mnemonic);
//   const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
//   const wallet = new web3.Account(keyPair.secretKey);

//   const receiverKey = new web3.PublicKey(receiver);
//   try {
//     const transaction1 = web3.SystemProgram.transfer({
//       fromPubkey: wallet.publicKey,
//       toPubkey: receiverKey,

//       lamports: parseFloat(amount) * 1000000000,
//     });

//     const transaction = new web3.Transaction().add(transaction1);

//     let signature = await web3.sendAndConfirmTransaction(
//       connection,
//       transaction,
//       [wallet]
//     );

//     console.log("SIGNATURE", signature);

//     return { succes: true, signature: signature };
//   } catch (err) {
//     return { succes: false, err: err };
//   }
// };

// module.exports = {
//   /**
//    * Create a wallet.
//    *
//    * @return {Object}
//    */
//   async create(ctx) {
//     const phrase = await regenerateSeedPhrase();
//     const fromWallet = await createAccountFromMnemonic(phrase);

//     const { keyPair, wallet } = fromWallet;

//     const entity = await strapi.services.wallets.create({
//       publicKey: wallet.publicKey.toString(),
//       secretKey: cryptr.encrypt(keyPair.secretKey.toString()),
//       mnemonic: cryptr.encrypt(phrase),
//     });

//     return sanitizeEntity(entity, { model: strapi.models.wallets });
//     // if (entity && entity.publicKey && entity.mnemonic) {
//     //   return {
//     //     publicKey: wallet.publicKey.toString(),
//     //     mnemonic: phrase,
//     //     mnemonicEnc: cryptr.encrypt(phrase),
//     //   };
//     // } else {
//     //   return {
//     //     publicKey: null,
//     //     mnemonic: null,
//     //     message: "Your wallet has not been created",
//     //   };
//     // }
//   },

//   /**
//    * create Token
//    *
//    * @return {Object}
//    */

//   async createToken(ctx) {
//     const { decimal, phrase, amount } = ctx.request.body;

//     const seed = await bip39.mnemonicToSeed(phrase);
//     const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
//     const fromWallet = new web3.Account(keyPair.secretKey);

//     // Create new token mint
//     const mint = await splToken.Token.createMint(
//       connection,
//       fromWallet,
//       fromWallet.publicKey,
//       null,
//       decimal,
//       splToken.TOKEN_PROGRAM_ID
//     );

//     const fromTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
//       fromWallet.publicKey
//     );
//     // Minting 1 new token to the "fromTokenAccount" account we just returned/created
//     await mint.mintTo(
//       fromTokenAccount.address,
//       fromWallet.publicKey,
//       [],
//       amount * 1000000000
//     );
//     console.log(res);
//     if (mint.publicKey) {
//       return {
//         success: false,
//         resp: "has been create",
//         address: mint.publicKey.toString(),
//         amount: amount * 1000000000,
//         amountUnit: amount,
//       };
//     }

//     return { success: false, resp: "has not been create" };
//   },

//   /**
//    * Mint Token
//    *
//    * @return {Object}
//    */

//   async mintSlpToken(ctx) {
//     const { phrase, receiver, tokenid, amount } = ctx.request.body;
//     try {
//       const result = await mintSlpToken(phrase, receiver, tokenid, amount);

//       return result;
//     } catch (e) {
//       // console.warn("Failed", e);
//       return { success: false, err: e };
//     }
//   },
//   /**
//    * Add SOL to a wallet.
//    *
//    * @return Number
//    */
//   async requestAirDrop(ctx) {
//     const { publicKey, amount } = ctx.params;
//     const key = new web3.PublicKey(publicKey);
//     const airdrop = connection.requestAirdrop(key, amount * 1000000000);

//     return { success: true, airdrop };
//   },

//   /**
//    * balance of a wallet.
//    *
//    * @return Number
//    */
//   async balanceWallet(ctx) {
//     const { address } = ctx.params;
//     const key = new web3.PublicKey(address);
//     const balance = await connection.getBalance(key);
//     const balanceUnit = balance / 1000000000;
//     return { balance, balanceUnit };
//   },

//   /**
//    * balance of a wallet.
//    *
//    * @return Number
//    */
//   async sendSolToken(ctx) {
//     try {
//       console.log("starting sendMoney");
//       const { phrase, receiver, amount } = ctx.request.body;
//       const result = await sendSolToken(phrase, receiver, amount);

//       return result;
//     } catch (e) {
//       // console.warn("Failed", e);
//       return { success: false, err: e };
//     }
//   },

//   /**
//    * Send slp token  wallet to wallet .
//    *
//    * @return Number
//    */
//   async sendSlpToken(ctx) {
//     const { phrase, receiver, tokenid, amount } = ctx.request.body;
//     try {
//       console.log("starting sendMoney");

//       const result = await sendSlpToken(phrase, receiver, tokenid, amount);

//       return result;
//     } catch (e) {
//       // console.warn("Failed", e);
//       return { success: false, err: e };
//     }
//   },
// };

module.exports = {};
