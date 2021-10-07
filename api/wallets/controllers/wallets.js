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
const { re } = require("semver");

const connection = new web3.Connection(
  web3.clusterApiUrl("devnet"),
  "confirmed"
);

const apricotLending = async () => {
  /*
   * When testing, try replacing privateKey with your own test private key. You can import the private key to sollet, then
   * use https://test.apricot.one to obtain test tokens (by clicking on faucet button)
   */

  const privateKey = [
    178, 232, 8, 19, 213, 26, 154, 245, 28, 57, 87, 115, 253, 90, 86, 29, 243,
    91, 130, 188, 231, 169, 0, 7, 11, 230, 207, 74, 53, 9, 27, 201, 9, 151, 130,
    190, 114, 135, 185, 118, 42, 198, 186, 198, 73, 49, 43, 211, 196, 237, 59,
    120, 150, 127, 22, 180, 13, 231, 43, 156, 252, 92, 148, 84,
  ];
  const testAccount = new web3.Account(privateKey);

  console.log(testAccount.publicKey.toString());
  const conn = connection;

  // fake btc mint (on devnet only)
  const fakeUsdcMint = new web3.PublicKey(apricot.mints.fake_usdc);
  // const fakeEthMint = new web3.PublicKey(apricot.mints.fake_eth);

  // get our associated token account for fakeBtcMint
  const testBtcSpl = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    fakeUsdcMint,
    testAccount.publicKey
  );

  // use wrapper to send transactions. Alternative us to use TxMaker, which builds transactions without sending them
  const wrapper = new apricot.ConnWrapper(conn);

  const isActive = await wrapper.isUserActive(testAccount.publicKey);

  if (isActive) {
    // if user already exists, make a direct deposit
    await wrapper.deposit(
      testAccount,
      testBtcSpl,
      apricot.mints.fake_usdc,
      1000000000 * 20
    );
    console.log("Deposited");
  } else {
    console.log("Start");
    // if user does not exist yet, initialize user info first, then deposit
    let rep = await wrapper.add_user_and_deposit(
      testAccount,
      testBtcSpl,
      apricot.mints.fake_usdc,
      100000000 * 20
    );

    console.log(rep);
    console.log("Deposited");

    // sleeping 20 seconds for account creation
    await new Promise((r) => setTimeout(r, 20000));
  }

  // withdraw 1000000 (0.001) fake BTC
  // await wrapper.withdraw(
  //   testAccount,
  //   testBtcSpl,
  //   apricot.mints.fake_usdc,
  //   false,
  //   1000000
  // );
  // console.log("Partially withdrawn");

  // borrow 1000000 (0.001) fake ETH
  // await wrapper.borrow(
  //   testAccount,
  //   testEthSpl,
  //   apricot.mints.fake_eth,
  //   1000000
  // );
  // console.log("Borrowed");

  // sleeping 20 seconds for updated result
  console.log("SLeeping 20 seconds for updated result");
  await new Promise((r) => setTimeout(r, 20000));
  console.log("UserInfo at the end:");
  console.log(await wrapper.getParsedUserInfo(testAccount.publicKey));
};
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
const validateRecoverPhrase = (phrase) => {
  if (phrase) {
    if (bip39.validateMnemonic(phrase)) {
      return "success";
    } else {
      return "error";
    }
  }
  return null;
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
const mintSlpToken = async (phrase, walletTo, tokenId, amount) => {
  const seed = await bip39.mnemonicToSeed(phrase);

  const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
  const fromWallet = new web3.Account(keyPair.secretKey);
  const keyTokenId = new web3.PublicKey(tokenId);
  const receiver = new web3.PublicKey(walletTo);

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

    // Minting 1 new token to the "fromTokenAccount" account we just returned/created
    let res = await token.mintTo(
      receiverTokenAccount.address,
      fromWallet.publicKey,
      [],
      amount * 1000000000
    );

    console.log(res);
    return { succes: true };
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
// apricotLending();
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
      0.0005
    );
    const entity = await strapi.services.wallets.create({
      publicKey: wallet.publicKey.toString(),
      secretKey: cryptr.encrypt(keyPair.secretKey.toString()),
      mnemonic: cryptr.encrypt(phrase),
    });

    return sanitizeEntity(entity, { model: strapi.models.wallets });
  },

  /**
   * create Token
   *
   * @return {Object}
   */

  async createToken(ctx) {
    const { decimal, phrase, amount } = ctx.request.body;

    const seed = await bip39.mnemonicToSeed(phrase);
    const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
    const fromWallet = new web3.Account(keyPair.secretKey);

    // Create new token mint
    const mint = await splToken.Token.createMint(
      connection,
      fromWallet,
      fromWallet.publicKey,
      null,
      decimal,
      splToken.TOKEN_PROGRAM_ID
    );

    const fromTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey
    );
    // Minting 1 new token to the "fromTokenAccount" account we just returned/created
    await mint.mintTo(
      fromTokenAccount.address,
      fromWallet.publicKey,
      [],
      amount * 1000000000
    );
    console.log(res);
    if (mint.publicKey) {
      return {
        success: false,
        resp: "has been create",
        address: mint.publicKey.toString(),
        amount: amount * 1000000000,
        amountUnit: amount,
      };
    }

    return { success: false, resp: "has not been create" };
  },

  /**
   * Mint Token
   * @param { phrase, receiver, tokenid, amount}
   * @return {Object}
   */

  async mintSlpToken(ctx) {
    const { phrase, receiver, tokenid, amount } = ctx.request.body;
    try {
      const result = await mintSlpToken(phrase, receiver, tokenid, amount);

      return result;
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
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
   * Add SOL to a wallet.
   *@param { publicKey, amount}
   * @return Number
   */
  async requestAirDrop(ctx) {
    const { publicKey, amount } = ctx.params;
    const key = new web3.PublicKey(publicKey);
    const airdrop = connection.requestAirdrop(key, amount * 1000000000);

    return { success: true, airdrop };
  },

  /**
   * Add SOL fee to a wallet.
   * @param { publicKey, amount}
   * @return Object
   */
  async refeedWallet(ctx) {
    const { publicKey, amount } = ctx.params;

    const feed = sendSolTokenFunc(process.env.MASTER_PHRASE, publicKey, amount);

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
   * Send token from a wallet to another wallet.
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
   * Sell slp token to user wallet .
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
   * Get pricot token .
   *@param { receiver, tokenid, amount}
   * @return Number
   */
  async getApricotData(ctx) {
    const { publickey } = ctx.params;
    try {
      console.log(publickey);
      // fake btc mint (on devnet only)
      const user = new web3.PublicKey(
        `${publickey}`
        // "eSfdrSYjDcpWvJbe3mBKNaK5zZhQ8YX9V9fgYzNZPmM"
      );

      const wrapper = new apricot.ConnWrapper(connection);

      const result = await wrapper.getParsedUserInfo(user);
      // console.log("uuuuuuu", result);
      return result;
    } catch (e) {
      // console.warn("Failed", e);
      return { success: false, err: e };
    }
  },

  /**
   * Get pricot token .
   *@param { receiver, tokenid, amount}
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
   * Get pricot token .
   *@param { receiver, tokenid, amount}
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
