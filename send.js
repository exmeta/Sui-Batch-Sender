const { SuiClient } = require('@mysten/sui.js/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const fs = require('fs');
const readline = require('readline');

// Use SuiClient
const client = new SuiClient({
  url: 'https://sui-testnet-rpc.publicnode.com',
});

// Read private keys from file (one key per line)
const privateKeys = fs.readFileSync('private_keys.txt', 'utf-8').trim().split('\n');

// Read receiver addresses from file (one address per line)
const receivers = fs.readFileSync('receivers.txt', 'utf-8').trim().split('\n');

const DELAY = 15000; // 15 seconds per transaction

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to send transaction
async function sendTransaction(privateKey, amountToSend, index) {
    try {
        // Remove '0x' prefix if present and convert to buffer
        const cleanedPrivateKey = privateKey.replace('0x', '');
        if (cleanedPrivateKey.length !== 64) {
            throw new Error('Kunci privat harus memiliki panjang 64 karakter (32 byte).');
        }
        
        const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(cleanedPrivateKey, 'hex'));
        const address = keypair.toSuiAddress();
        
        console.log(`?? Processing wallet ${index + 1}: ${address}`);
        
        // Get balance of SUI
        const { totalBalance } = await client.getBalance({
            owner: address,
            coinType: '0x2::sui::SUI'
        });
        
        console.log(`?? ${address} | Balance: ${parseInt(totalBalance) / 1000000000} SUI`);

        const amountToSendInMIST = amountToSend * 1000000000; // Konversi ke MIST

        if (parseInt(totalBalance) < amountToSendInMIST + 2000000) { // 0.002 SUI for gas buffer
            console.log(`?? Saldo tidak cukup.`);
            return;
        }

        // Create transaction block
        const tx = new TransactionBlock();
        
        // Send to each receiver address
        for (const receiver of receivers) {
            tx.transferObjects([
                tx.splitCoins(tx.gas, [tx.pure(amountToSendInMIST)]),
            ], tx.pure(receiver));
            console.log(`?? Sending ${amountToSend} SUI to ${receiver}`);
        }
        
        // Execute transaction
        const result = await client.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: tx,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });

        console.log(`?? TX: ${result.digest}`);
        console.log(`? Berhasil mengirim ke semua penerima.`);
    } catch (error) {
        console.error(`? Error:`, error.message);
    }
}

// Function to prompt user for amount and send transactions
function promptForAmount(privateKey, index) {
    rl.question('Masukkan jumlah SUI yang ingin dikirim: ', async (amount) => {
        const amountToSend = parseFloat(amount);
        if (isNaN(amountToSend) || amountToSend <= 0) {
            console.log('? Jumlah tidak valid. Silakan masukkan angka yang valid.');
            promptForAmount(privateKey, index); // Prompt again
        } else {
            await sendTransaction(privateKey, amountToSend, index);
            if (index < privateKeys.length - 1) {
                setTimeout(() => promptForAmount(privateKeys[index + 1], index + 1), DELAY);
            } else {
                rl.close(); // Close readline interface after all transactions
            }
        }
    });
}

// Start prompting for the first private key
promptForAmount(privateKeys[0], 0);