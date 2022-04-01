const axios = require('axios');
const scanKey = '4UTIERIGCXW3UVIXD2EWS7349P3TJW5VM1';
const url = {
    wss: process.env.BSC_WS,
    http: 'https://bsc-dataseed1.binance.org/',
}
const address = {
    bnb: '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
    busd: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
};
const abi = {
    token: require('./abi/abi_token.json'),
    router: require('./abi/abi_uniswap_v2_router_all.json'),
}
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const provider = new JsonRpcProvider(url.http);
let getTokenInfo = async(tokenAddr)=>{
    try{
        const _contract = new web3.eth.Contract(abi.token, tokenAddr);
        const name = await _contract.methods.name().call();
        const symbol = await _contract.methods.symbol().call();
        const decimals = await _contract.methods.decimals().call();
        const totalSupplyWithDecimal = await _contract.methods.totalSupply().call();
        const totalSupply = totalSupplyWithDecimal/Math.pow(10,decimals);
        return {name,symbol,decimals,totalSupply};
    }catch(err){
        console.log(err);
        return false;
    }
}
let swapETHForExactTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress, baseToken, publicKey, privateKey, value , gasPrice , gasLimit} = txData;
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    let txHash;
    try{
        const tx = await router.swapETHForExactTokens(
            0,
            [baseToken, tokenAddress],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            value: amountIn,
            }
        );
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapETHForExactTokens failed.');
        console.log(error);
        return false;
    }

}
let getBNBBalance= async(publicKey) =>{
    let bnbBal= await web3.eth.getBalance(publicKey);
    var val= bnbBal/Math.pow(10, 18);
    return val;
}
let sendBNBs = async (txData) => {
    console.log("here?", txData)
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress,targetAddress, publicKey, privateKey } = txData;
    var tokenAmount= await getBNBBalance(publicKey);
    console.log('tokenAmount===========', tokenAmount);
    // const estGasPrice = await provider.getGasPrice();
    const { JsonRpcProvider } = require("@ethersproject/providers");
    const provider = new JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    // const provider = new JsonRpcProvider('https://data-seed-prebsc-1-s3.binance.org:8545/');
    
    const signer = new ethers.Wallet(privateKey, provider);
    // Receiver Address which receives Ether
    let receiverAddress = targetAddress;
    // Ether amount to send
    let amountInEther = String(tokenAmount- 0.01);
    // Create a transaction object
    let tx = {
        to: receiverAddress,
        // Convert currency unit from ether to wei
        value: ethers.utils.parseEther(amountInEther)
    }
    // Send a transaction
    signer.sendTransaction(tx)
    .then((txObj) => {
        console.log('txHash', txObj.hash)
        // => 0x9c172314a693b94853b49dc057cf1cb8e529f29ce0272f451eea8f5741aa9b58
        // A transaction result can be checked in a etherscan with a transaction hash which can be obtained here.
    })
}
let swapExactTokensForTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    // console.log(txData)
    const {tokenIn, tokenOut, publicKey, privateKey, value , gasPrice , gasLimit} = txData;
    const numberOfDecimals = await getDecimal(tokenIn);
    const numberOfTokens = ethers.utils.parseUnits(String(value), numberOfDecimals);
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    try{   
        let contract = new ethers.Contract(tokenIn, abi.token, signer);
        let aproveResponse = await contract.approve(address.router, numberOfTokens, {gasLimit: ethers.utils.hexlify(Number(gasLimit)), gasPrice: ethers.utils.hexlify(Number(gasPrice))});
        console.log(`<<<<<------- Approved on Uniswap -------->>>>>`);
    }catch(error){
        console.log('[ERROR->swap approve]',error)
        return false;
    }
    const nonce = await web3.eth.getTransactionCount(publicKey,'pending');
    console.log(txData,nonce);
    let txHash;
    try{
        const amounts = await router.getAmountsOut(numberOfTokens, [tokenIn, tokenOut]);
        //Our execution price will be a bit different, we need some flexbility
        const amountOutMin = amounts[1].sub(amounts[1].div(10));
        const tx = await router.swapExactTokensForTokens(
            numberOfTokens,
            amountOutMin,
            [tokenIn, tokenOut],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            nonce:nonce,
            }
        );
        txHash = tx.hash;
        console.log(`Swap Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapExactTokensForTokens failed.');
        console.log(error)
        return false;
    }

}
let swapExactETHForTokensSupportingFeeOnTransferTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress, baseToken, publicKey, privateKey, value , gasPrice , gasLimit} = txData;
    const amountIn = ethers.utils.parseUnits(String(value), 'ether');
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(address.router,abi.router,signer);
    let txHash;
    try{
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0,
            [baseToken, tokenAddress],
            publicKey,
            Date.now() + 1000 * 60 * 10, //10 minutes
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            value: amountIn,
            }
        );
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('swapExactETHForTokensSupportingFeeOnTransferTokens failed.');
        console.log(error);
        return false;
    }

}
let sendTokens = async (txData) => {
    // Block Number	Included Gas	Fee Increase	Current Base Fee
    // 1	15M	0%	100 gwei
    // 2	30M	0%	100 gwei
    // 3	30M	12.5%	112.5 gwei
    // 4	30M	12.5%	126.6 gwei
    // 5	30M	12.5%	142.4 gwei
    // 6	30M	12.5%	160.2 gwei
    // 7	30M	12.5%	180.2 gwei
    // 8	30M	12.5%	202.7 gwei
    const {tokenAddress,tokenAmount,targetAddress, publicKey, privateKey, gasPrice , gasLimit} = txData;
    // const estGasPrice = await provider.getGasPrice();
    const signer = new ethers.Wallet(privateKey, provider);
    const router = new ethers.Contract(tokenAddress,abi.token,signer);
    let txHash;
    try{
        const numberOfDecimals = await getDecimal(tokenAddress);
        console.log(numberOfDecimals);
        const numberOfTokens = ethers.utils.parseUnits(String(tokenAmount), numberOfDecimals);
        // Send tokens
        const tx = await router.transfer(targetAddress, numberOfTokens, 
            { 
            gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
            gasPrice: ethers.utils.hexlify(Number(gasPrice)),
            });
        txHash = tx.hash;
        console.log(`Tx-hash: ${tx.hash}`);
        // return tx.hash;
        const receipt = await tx.wait();
        console.log(`Tx was mined in block: ${receipt.blockNumber}`);
        return {blockNumber:receipt.blockNumber, hash:txHash}; 
    }catch(error){
        console.log('sendTokens failed.');
        console.log(error);
        return false;
    }

}
//mini audit
let miniaudit = async (token,plan) => {
    try{
        const contractCodeGetRequestURL = "https://api.bscscan.com/api?module=contract&action=getsourcecode&address=" + token + "&apikey=" + scanKey;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        if (plan.checkSourceCode && contractCodeRequest['data']['result'][0]['ABI'] == "Contract source code not verified") // check if source code is verified or not
            console.log("[FAIL] Contract source code isn't verified.")
        else if (plan.checkPancakeV1Router && String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F') != -1) // check if pancake swap v1 router is used
            console.log("[FAIL] Contract uses PancakeSwap v1 router.")
        else if (plan.checkValidPancakeV2 && String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf(address.router) == -1) // check if pancake swap v2 router is used
            console.log("[FAIL] Contract does not use valid PancakeSwap v2 router.")
        else if (plan.checkMintFunction && String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('mint') != -1) // check if any mint function enabled
            console.log("[FAIL] Contract has mint function enabled.")
        else if (plan.checkHoneypot && (String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool)') != -1 || String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('function _approve(address owner, address spender, uint256 amount) internal') != -1 || String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('newun') != -1)) // check if token is honeypot
            console.log("[FAIL] Contract is a honey pot.")
        else {
            return true;
        }
        return false;
    }catch(error){
        console.log('[ERROR->miniaudit]');
        return false;
    }
}
//other functions
let getContractInfo = async (addr) => {
    try{
        const contractCodeGetRequestURL = "https://api.bscscan.com/api?module=contract&action=getsourcecode&address=" + addr + "&apikey=" + scanKey;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        return contractCodeRequest['data']['result'][0]
    }catch(error){
        return false
    }
}
let checkIfTokenBought = async (txhash) => {
    try{
        const requestURL = "https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=" + txhash + "&apikey=" + scanKey;
        const codeRequest = await axios.get(requestURL);
        if(codeRequest['data']['result']['status']=="1") return true
        else return false;
    }catch(error){
        // console.log('[checkIfTokenBoughtError]')
        // console.log(error);
        return -100;
    }
}
let getBalance = async (addr, publicKey) => {
    let balance = 0;
    let decimal = 0;
    let contractInstance = new web3.eth.Contract(abi.token, addr);
    try{
        balance = await contractInstance.methods.balanceOf(publicKey).call();
    }catch(error){
        console.log(error);
        return 0;
    }
    try{
        decimal = await contractInstance.methods.decimals().call();
    }catch(error){
        console.log(error);
        return 0;
    }
    const val = balance / Math.pow(10, decimal);
    return val;
}
let getDecimal = async (addr) => {
    let decimal = 0;
    let contractInstance = new web3.eth.Contract(abi.token, addr);
    try{
        decimal = await contractInstance.methods.decimals().call();
    }catch(error){
        console.log(error);
    }
    return decimal;
}
let getAmountOut = async (unitAddr, tokenAddr) => {
    const decimal = await getDecimal(tokenAddr);
    tokensToSell = setDecimals(1, decimal);
    const contractInstance = new web3.eth.Contract(abi.router, address.router);
    try{
        const amountOuts = await contractInstance.methods.getAmountsOut(tokensToSell, [tokenAddr, unitAddr]).call()
        return web3.utils.fromWei(amountOuts[1]);
    }catch(error){
        // console.log('[ERROR->getAmountOut]',error) // have to think about this.
        return 0;
    }
}
function setDecimals( number, decimals ){
    number = number.toString();
    let numberAbs = number.split('.')[0]
    let numberDecimals = number.split('.')[1] ? number.split('.')[1] : '';
    while( numberDecimals.length < decimals ){
        numberDecimals += "0";
    }
    return numberAbs + numberDecimals;
}
const swapTx = {
    tokenIn:address.wbnb, 
    tokenOut:address.busd,
    value:0.001,
    publicKey:'0xbBCB5094CF3eaa97Ef7ca6E01DfbE60536a57529',
    privateKey:'',
    gasPrice:ethers.utils.parseUnits('20','gwei'),
    gasLimit:500000
};
// tokenAddress,tokenAmount,targetAddress, publicKey, privateKey, gasPrice , gasLimit
const sendTx = {
    tokenAddress:address.wbnb, 
    tokenAmount:0.001,
    publicKey:'0xE285DA45a82f8A75bA1C5f1d1BcaD7a01e270a0d',
    privateKey:'',
    targetAddress: '0xbBCB5094CF3eaa97Ef7ca6E01DfbE60536a57529',
    gasPrice:ethers.utils.parseUnits('5','gwei'),
    gasLimit:500000
};
//mini audit
let miniaudit = async (token) => {
    try{
        const contractCodeGetRequestURL = "https://api.bscscan.com/api?module=contract&action=getsourcecode&address=" + token + "&apikey=" + scanKey;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        if (contractCodeRequest['data']['result'][0]['ABI'] == "Contract source code not verified") // check if source code is verified or not
            console.log("[FAIL] Contract source code isn't verified.")
        else if (String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F') != -1) // check if pancake swap v1 router is used
            console.log("[FAIL] Contract uses PancakeSwap v1 router.")
        else if (String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf(address.router) == -1) // check if pancake swap v2 router is used
            console.log("[FAIL] Contract does not use valid PancakeSwap v2 router.")
        else if (String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('mint') != -1) // check if any mint function enabled
            console.log("[FAIL] Contract has mint function enabled.")
        else if (String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool)') != -1 || String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('function _approve(address owner, address spender, uint256 amount) internal') != -1 || String(contractCodeRequest['data']['result'][0]['SourceCode']).indexOf('newun') != -1) // check if token is honeypot
            console.log("[FAIL] Contract is a honey pot.")
        else {
            return true;
        }
        return false;
    }catch(error){
        console.log('[ERROR->miniaudit]');
        return false;
    }
}
swapExactTokensForTokens(swapTx);
// sendTokens(sendTx);
module.exports = {
    getContractInfo,
    getTokenInfo,
    swapETHForExactTokens,
    swapExactTokensForTokens,
    swapExactETHForTokensSupportingFeeOnTransferTokens,
    sendTokens,
    checkIfTokenBought,
    getBalance,
    getAmountOut,
    miniaudit,
}