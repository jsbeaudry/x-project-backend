"use strict";

const { sanitizeEntity } = require("strapi-utils");
const web3 = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const bip39 = require("bip39");

const nacl = require("tweetnacl");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Cryptr = require("cryptr");
const cryptr = new Cryptr(process.env.SECRETKEY);
const apricot = require("@apricot-lend/apricot");
// const Moncash = require("moncash");

// const moncash = new Moncash({
//   mode: "sandbox", // 'sandbox' | 'live'
//   clientId: "5ad03fba8fbd6ef1062920377bc495b8",
//   clientSecret:
//     "-FUYsAOe9xwfwfPZz6WIgynNRAFH530HaMJRt_Dws_YO4aa6HbYZUBDb1OJ5RK-I",
// });

// moncash.transfert.create(
//   {
//     receiver: "50937649948",
//     amount: "100", // Ex: 50
//     desc: "Just to test",
//   },
//   (err, transfert) => {
//     if (err) {
//       console.log(err);
//       return false;
//     }
//     console.log(transfert);
//   }
// );

const connection = new web3.Connection(
  web3.clusterApiUrl("devnet"),
  "confirmed"
);

const regenerateSeedPhrase = () => {
  const phrase = bip39.generateMnemonic();
  return phrase;
};
const createAccountFromMnemonic = async (mnemonic) => {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
  const wallet = new web3.Account(keyPair.secretKey);

  const account = {
    keyPair,
    wallet,
  };
  return await account;
};

const sendSlpToken = async (
  phrase,
  walletTo,
  tokenId,
  tokenDecimal,
  amount,
  action
) => {
  //Get the seed
  const uncrypt = cryptr.decrypt(phrase);
  const seed = await bip39.mnemonicToSeed(uncrypt);
  //Get the KeyPair
  const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

  //Token pulic KEY
  const keyTokenId = new web3.PublicKey(tokenId);

  //Sender public wallet
  const fromWallet = new web3.Account(keyPair.secretKey);

  //Receiver public KEY
  const receiver = new web3.PublicKey(walletTo);

  //Receiver public KEY
  const master = new web3.PublicKey(`${process.env.MASTER_PUBLICKEY}`);

  try {
    // Load new token mint
    const token = new splToken.Token(
      connection,
      keyTokenId,
      splToken.TOKEN_PROGRAM_ID,
      fromWallet
    );

    // Create associated token accounts for my token if they don't exist yet
    var fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey
    );

    var receiverTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      receiver
    );

    var masterTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      master
    );

    console.log("publicKey", token.publicKey.toString());
    console.log("programId", token.programId.toString());
    console.log("associatedProgramId", token.associatedProgramId.toString());
    console.log("payer", token.payer.publicKey.toString());

    // Add token transfer instructions to transaction
    var transaction = new web3.Transaction({
      // feePayer: receiverTokenAccount.address,
    });
    console.log("add tx");

    transaction.add(
      splToken.Token.createTransferInstruction(
        splToken.TOKEN_PROGRAM_ID,
        fromTokenAccount.address,
        receiverTokenAccount.address,
        fromWallet.publicKey,
        [],
        amount * 10 ** tokenDecimal
      )
    );

    //take fee only on transfer User - User
    if (action == "send") {
      console.log("add fee");

      transaction.add(
        splToken.Token.createTransferInstruction(
          splToken.TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          masterTokenAccount.address,
          fromWallet.publicKey,
          [],
          0.1 * 10 ** tokenDecimal
        )
      );
    }

    // Sign transaction, broadcast, and confirm
    var signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet]
    );

    return { succes: true, signature: signature };
  } catch (err) {
    return { succes: false, err: err };
  }
};

const sendSolTokenFunc = async (phrase, receiver, amount) => {
  const uncrypt = cryptr.decrypt(phrase);
  const seed = await bip39.mnemonicToSeed(uncrypt);
  const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
  const wallet = new web3.Account(keyPair.secretKey);

  const receiverKey = new web3.PublicKey(receiver);
  try {
    const transaction1 = web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: receiverKey,

      lamports: parseFloat(amount) * 1000000000,
    });

    const transaction = new web3.Transaction().add(transaction1);

    let signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );

    console.log("SIGNATURE", signature);

    return { succes: true, signature: signature };
  } catch (err) {
    return { succes: false, err: err };
  }
};

module.exports = {
  /**
   * Create a wallet.
   *
   * @return {Object}
   */
  async create(ctx) {
    const phrase = await regenerateSeedPhrase();
    const fromWallet = await createAccountFromMnemonic(phrase);

    const { keyPair, wallet } = fromWallet;

    sendSolTokenFunc(
      process.env.MASTER_PHRASE,
      wallet.publicKey.toString(),
      0.016
    );
    const entity = await strapi.services.wallets.create({
      publicKey: wallet.publicKey.toString(),
      secretKey: cryptr.encrypt(keyPair.secretKey.toString()),
      mnemonic: cryptr.encrypt(phrase),
    });

    return sanitizeEntity(entity, { model: strapi.models.wallets });
  },

  /**
   * Stripe payment
   * @body { amount, name, currency}
   * @return {Object}
   */

  async setPayment(ctx) {
    try {
      // Getting data from client
      const { amount, metadata, currency } = ctx.request.body;

      // Simple validation
      if (!amount || !metadata) return { message: "All fields are required" };
      // amount = parseInt(amount);
      // Initiate payment
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency,
        payment_method_types: ["card"],
        metadata,
      });
      // Extracting the client secret
      const clientSecret = paymentIntent.client_secret;
      // Sending the client secret as response

      return { message: "Payment initiated", clientSecret };
    } catch (err) {
      // Catch any error and send error 500 to client
      console.error(err);
      return { message: "Internal Server Error" };
    }
  },

  /**
   * Add SOL fee to a wallet.
   * @param { publicKey, amount}
   * @return Object
   */
  async refeedWallet(ctx) {
    const { publicKey, amount } = ctx.params;

    const feed = await sendSolTokenFunc(
      process.env.MASTER_PHRASE,
      publicKey,
      amount
    );

    return { success: true, feed };
  },

  /**
   * balance of a wallet.
   *@param { publicKey}
   * @return Object
   */
  async balanceWallet(ctx) {
    const { address } = ctx.params;
    const key = new web3.PublicKey(address);
    const balance = await connection.getBalance(key);
    const balanceUnit = balance / 1000000000;
    return { balance, balanceUnit };
  },

  /**
   * Send SOL  wallet to  wallet.
   * @param { phrase, receiver, amount}
   * @return Number
   */
  async sendSolToken(ctx) {
    try {
      console.log("starting sendMoney");
      const { phrase, receiver, amount } = ctx.request.body;
      const result = await sendSolTokenFunc(phrase, receiver, amount);

      return result;
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
  },

  /**
   * Send slp token  wallet to wallet .
   *
   * @return Object
   */
  async sendSlpToken(ctx) {
    const { phrase, receiver, tokenid, tokenDecimal, amount } =
      ctx.request.body;
    try {
      console.log("starting sendMoney");

      const result = await sendSlpToken(
        phrase,
        receiver,
        tokenid,
        tokenDecimal,
        amount,
        "send"
      );

      return result;
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
  },
  /**
   * Sell slp token to user  .
   *@param { receiver, tokenid, amount}
   * @return Number
   */
  async sellSlpToken(ctx) {
    const { receiver, tokenid, tokenDecimal, amount } = ctx.request.body;
    try {
      console.log("starting sell SLP token");

      const result = await sendSlpToken(
        process.env.MASTER_PHRASE,
        receiver,
        tokenid,
        tokenDecimal,
        amount,
        "sell"
      );

      return result;
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
  },

  /**
   * Get Apricot Lending info .
   *@param { publickey}
   * @return Number
   */
  async getApricotData(ctx) {
    const { publickey } = ctx.params;
    try {
      console.log(publickey);
      const user = new web3.PublicKey(`${publickey}`);

      const wrapper = new apricot.ConnWrapper(connection);

      const result = await wrapper.getParsedUserInfo(user);

      return result;
    } catch (e) {
      return { success: false, err: e };
    }
  },

  /**
   * Set Apricot lending token .
   *@param { phrase, amount}
   * @return Number
   */
  async setApricotLending(ctx) {
    const { phrase, amount } = ctx.request.body;
    const uncrypt = cryptr.decrypt(phrase);
    const seed = await bip39.mnemonicToSeed(uncrypt);
    //Get the KeyPair
    const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

    try {
      //Sender public wallet
      const userAccount = new web3.Account(keyPair.secretKey);

      const conn = connection;

      // fake btc mint (on devnet only)
      const fakeUsdcMint = new web3.PublicKey(apricot.mints.fake_usdc);

      // get our associated token account for fakeBtcMint
      const usdcSpl = await splToken.Token.getAssociatedTokenAddress(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        fakeUsdcMint,
        userAccount.publicKey
      );

      // use wrapper to send transactions. Alternative us to use TxMaker, which builds transactions without sending them
      const wrapper = new apricot.ConnWrapper(conn);

      const isActive = await wrapper.isUserActive(userAccount.publicKey);
      let rep = null;
      if (isActive) {
        // if user already exists, make a direct deposit
        rep = await wrapper.deposit(
          userAccount,
          usdcSpl,
          apricot.mints.fake_usdc,
          1000000000 * amount
        );
        console.log("Deposited");
        console.log(rep);
        return { success: true, data: rep };
      } else {
        console.log("Start");
        // if user does not exist yet, initialize user info first, then deposit
        rep = await wrapper.add_user_and_deposit(
          userAccount,
          usdcSpl,
          apricot.mints.fake_usdc,
          1000000000 * amount
        );
        console.log("Deposited");
        console.log(rep);
        return { success: true, data: rep };
      }
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
  },

  /**
   * Set Apricot Withdraw Lending .
   *@param { phrase, amount}
   * @return Number
   */
  async setApricotWithdraw(ctx) {
    const { phrase, amount } = ctx.request.body;
    const uncrypt = cryptr.decrypt(phrase);
    const seed = await bip39.mnemonicToSeed(uncrypt);
    //Get the KeyPair
    const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

    try {
      //Sender public wallet
      const userAccount = new web3.Account(keyPair.secretKey);

      const conn = connection;

      // fake btc mint (on devnet only)
      const fakeUsdcMint = new web3.PublicKey(apricot.mints.fake_usdc);

      // get our associated token account for fakeBtcMint
      const usdcSpl = await splToken.Token.getAssociatedTokenAddress(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        fakeUsdcMint,
        userAccount.publicKey
      );

      // use wrapper to send transactions. Alternative us to use TxMaker, which builds transactions without sending them
      const wrapper = new apricot.ConnWrapper(conn);

      let rep = await wrapper.withdraw(
        userAccount,
        usdcSpl,
        apricot.mints.fake_usdc,
        false,
        1000000000 * amount
      );

      console.log(JSON.stringify({ success: true, data: rep }));
      return { success: true, data: rep };
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
  },
};
