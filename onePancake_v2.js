//this is for uniswap v2
const axios = require('axios');
const scanKey = '4UTIERIGCXW3UVIXD2EWS7349P3TJW5VM1';
const Plan = require("../models/one_token_bsc_plan");
const Logs = require("../models/one_token_bsc_logs");
const Wallet = require("../models/wallet");
const core_func = require('../utils/core_func');
const url = {
    wss: process.env.BSC_WS,
    http: process.env.BSC_HTTP,
}
const address = {
    busd: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
};
const abi = {
    token: require('./abi/abi_token.json'),
    factory:require('./abi/abi_uniswap_v2').factory,
    router: require('./abi/abi_uniswap_v2_router_all.json'),
}

const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const factory = new ethers.Contract(address.factory, abi.factory,httpprovider);
const provider = httpprovider;
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const uniswapAbi = new ethers.utils.Interface(abi.router);
let socketT;
let plan;
let snipperTokens=[];
let snipperFuntions=[];
let snipperSetting={};

//control
let control = {
    botIsBusy:false,
    limitBuyMode:true,
    limitBuyCount:2,
}
let sendGas = {
    gasPrice:5,
    gasLimit:300000
}
const frontRunGasPlusFee = 0.000001111;//(gwei)
// const frontRunGasPlusFee = 15;//(gwei)
//###################### init of bot
//#####################################################
let init = async () => {
    console.log('~~~~~~pancakev2~~~~~~~')
    factory.on("PairCreated", async (token0, token1, addressPair) => {
            console.log('[PancakeTokenDetected] ',core_func.strftime(Date.now()), token0, token1, addressPair)
            try{
                if(plan && plan.status == 1 && (!control.limitBuyMode || control.limitBuyCount>0)){ // check bot is busy now or allowed to run.
                    const snipperTokens = plan.snipperToken?String(plan.snipperToken).split(','):[];
                    if(snipperTokens.length==0){//if snipper token is null
                        if((token1 == address.busd || token1 == address.wbnb)){ // if token0 is our target
                            if(plan.enableMiniAudit){//check miniaudit
                                const auditResult = await miniaudit(token0,plan);
                                if(auditResult){
                                    await buyTokens(token0,address.wbnb,plan.public,plan.private,plan.eth,plan.gasPrice,plan.gasLimit,plan.autoSellPriceTimes,'');
                                }
                            }else{
                                await buyTokens(token0,address.wbnb,plan.public,plan.private,plan.eth,plan.gasPrice,plan.gasLimit,plan.autoSellPriceTimes,'');
                            }
                        }
                        else if((token0 == address.busd || token0 == address.wbnb)){ // if token1 is our target
                            if(plan.enableMiniAudit){//check miniaudit
                                const auditResult = await miniaudit(token1,plan);
                                if(auditResult){
                                    await buyTokens(token1,address.wbnb,plan.public,plan.private,plan.eth,plan.gasPrice,plan.gasLimit,plan.autoSellPriceTimes,'');
                                }
                            }else{
                                await buyTokens(token1,address.wbnb,plan.public,plan.private,plan.eth,plan.gasPrice,plan.gasLimit,plan.autoSellPriceTimes,'');
                            }
                        }
                    }else{//if snipper token exist
                        if(snipperTokens.indexOf(token0)!=-1){//if token0 is our target
                            await buyTokens(token0,address.wbnb,plan.public,plan.private,plan.eth,plan.gasPrice,plan.gasLimit,plan.autoSellPriceTimes,'');
                        }
                        else if(snipperTokens.indexOf(token1)!=-1){//if token1 is our target
                            await buyTokens(token1,address.wbnb,plan.public,plan.private,plan.eth,plan.gasPrice,plan.gasLimit,plan.autoSellPriceTimes,'');
                        }
                    }
                }
            }catch(e){
                console.log('[ERROR->paircreated]',e)
            }
           
        }
    )
}
let initMempool = async () => {
    console.log('~~~~~~pancakev2 mempool~~~~~~~')
    await prepareBot();
    const baseToken = address.wbnb;
    const re = new RegExp("^0xf305d719");
    const me = new RegExp("^0xe8e33700");
    const he = new RegExp("^0x267dd102");
    const openTrading = new RegExp("^0xc9567bf9");
    const startTrading = new RegExp("^0x293230b8");
    const swapETHForExactTokens = new RegExp("^0xfb3bdb41");
    const swapExactETHForTokens = new RegExp("^0x7ff36ab5");
    // const swapExactETHForTokensSupportingFeeOnTransferTokens = new RegExp("^");
    const swapExactTokensForETH = new RegExp("^0x18cbafe5");
    // const swapExactTokensForETHSupportingFeeOnTransferTokens = new RegExp("^");
    const swapExactTokensForTokens = new RegExp("^0x38ed1739");
    const swapExactTokensForTokensSupportingFeeOnTransferTokens = new RegExp("^0x5c11d795");
    // const swapTokensForExactETH = new RegExp("^");
    const swapTokensForExactTokens = new RegExp("^0x8803dbee");
    wssprovider.on("pending", async (tx) => 
        {
            if(true){
                wssprovider.getTransaction(tx).then(
                    async function (transaction)
                            {
                                try{
                                    //check in uniswapv2 router
                                    if(transaction && transaction.to == address.router){
                                        // console.log(transaction);
                                        if (re.test(transaction.data) || me.test(transaction.data))
                                            {// listen addliquidity event
                                                try{
                                                    const decodedInput = uniswapAbi.parseTransaction({
                                                        data: transaction.data,
                                                        value: transaction.value,
                                                    });
                                                    // console.log(decodedInput);
                                                    const tokenName = typeof(decodedInput.args['token'])=='string'?decodedInput.args['token'].toLowerCase():decodedInput.args[0].toLowerCase();
                                                    const waitTime = snipperSetting[tokenName].waitTime?snipperSetting[tokenName].waitTime:0;
                                                    const snipperAmount = snipperSetting[tokenName].eth?snipperSetting[tokenName].eth:0;
                                                    const gasFeeEther = ethers.utils.formatEther(transaction.gasPrice)*1000000000+frontRunGasPlusFee;
                                                    const gasFeeConverted = ethers.utils.formatEther(transaction.gasPrice)*1000000000;
                                                    const gasFee = ethers.utils.parseUnits(String(gasFeeEther.toFixed(9)), "gwei");
                                                    console.log("|-------------------------------------ADDLIQUIDITYEVENT OF PANCAKE-----------------------------");
                                                    console.log(`|   [${decodedInput.name}],snipper[${snipperTokens}]`);
                                                    console.log('|   [hash]->',transaction.hash);
                                                    console.log('|   [tokenName]->',tokenName);
                                                    console.log('|   [waitTime,snipperAmount]->',waitTime,snipperAmount);
                                                    console.log('|   [gas,limit]',transaction.gasPrice,transaction.gasLimit);
                                                    console.log('|   [maxPriorityFeePerGas,maxFeePerGas]',transaction.maxPriorityFeePerGas,transaction.maxFeePerGas);
                                                    console.log('|   [gasNum]',gasFeeEther);
                                                    // console.log('[hash,tokenName,token0,token1]',transaction.hash,tokenName,decodedInput.args[0],decodedInput.args[1]);
                                                    console.log("|------------------------------------------------------------------------------|");
                                                    // console.log('[Mempool->new token info]',transaction.hash,transaction.gasPrice,transaction.gasLimit,gasFee,gasFee1);
                                                    if(plan && plan.status ==1){
                                                        if(snipperTokens.length==0 && (control.limitBuyMode === false || control.limitBuyCount > 0)){//in case of all tokens
                                                            if(true){// we buy all tokens that gasFee is over than 100 gwei
                                                                control.limitBuyCount--;
                                                                await buyTokens(tokenName,baseToken,plan.public,plan.private,snipperAmount,gasFee,transaction.maxPriorityFeePerGas,transaction.maxFeePerGas,transaction.gasLimit,plan.autoSellPriceTimes,waitTime,transaction.hash);
                                                            }
                                                        }else{//in case of special token
                                                            if(snipperTokens.indexOf(tokenName)!=-1) {// check if token name is included to tokenName arrays
                                                                await buyTokens(tokenName,baseToken,plan.public,plan.private,snipperAmount,gasFee,transaction.maxPriorityFeePerGas,transaction.maxFeePerGas,transaction.gasLimit,plan.autoSellPriceTimes,waitTime,transaction.hash);
                                                            }
                                                            else if(typeof(decodedInput.args[1])=='string'&&snipperTokens.indexOf(decodedInput.args[1].toLowerCase())!=-1){// check if token name in args[1]
                                                                await buyTokens(decodedInput.args[1].toLowerCase(),baseToken,plan.public,plan.private,snipperAmount,gasFee,transaction.maxPriorityFeePerGas,transaction.maxFeePerGas,transaction.gasLimit,plan.autoSellPriceTimes,waitTime,transaction.hash);
                                                            }
                                                        }
                                                    }
                                                }catch(error){
                                                    // console.log('[ERROR->pending->getTransaction->if]',error)
                                                    console.log('[ERROR->getTransaction->if]',error)
                                                }
                                            }
                                    }
                                    //check opentrading
                                    else if(transaction && (snipperTokens.indexOf(String(transaction.to).toLowerCase())!=-1 || snipperTokens.length==0)){
                                        let tokenName = transaction.to;
                                        const resultOfRegEx = checkRegEx(snipperFuntions,transaction.data);
                                        if (resultOfRegEx==true){
                                            try{
                                                const waitTime = snipperSetting[tokenName].waitTime?snipperSetting[tokenName].waitTime:0;
                                                const snipperAmount = snipperSetting[tokenName].eth?snipperSetting[tokenName].eth:0;
                                                const gasFeeEther = ethers.utils.formatEther(transaction.gasPrice)*1000000000+frontRunGasPlusFee;
                                                const gasFeeConverted = ethers.utils.formatEther(transaction.gasPrice)*1000000000;
                                                const gasFee = ethers.utils.parseUnits(String(gasFeeEther.toFixed(9)), "gwei");
                                                console.log("|-------------------------------------OPENTRADING PANCAKE------------------------------|");
                                                console.log(`|    transaction[${tokenName}],snipper[${snipperTokens}]`);
                                                console.log('|    [hash]->',transaction.hash);
                                                console.log('|    [tokenName]->',tokenName);
                                                console.log('|    [waitTime,snipperAmount]->',waitTime,snipperAmount);
                                                console.log('|    [gas,limit]',transaction.gasPrice,transaction.gasLimit);
                                                console.log('|    [maxPriorityFeePerGas,maxFeePerGas]',transaction.maxPriorityFeePerGas,transaction.maxFeePerGas);
                                                console.log('|    [gasNum]',gasFeeEther);
                                                console.log("|------------------------------------------------------------------------------|");
                                                if(plan && plan.status ==1){
                                                    if(snipperTokens.length==0 && (control.limitBuyMode === false || control.limitBuyCount > 0)){
                                                        await buyTokens(tokenName,baseToken,plan.public,plan.private,snipperAmount,gasFee,transaction.maxPriorityFeePerGas,transaction.maxFeePerGas,transaction.gasLimit,plan.autoSellPriceTimes,waitTime,transaction.hash);
                                                    }
                                                    else if(snipperTokens.length>0){
                                                        await buyTokens(tokenName,baseToken,plan.public,plan.private,snipperAmount,gasFee,transaction.maxPriorityFeePerGas,transaction.maxFeePerGas,transaction.gasLimit,plan.autoSellPriceTimes,waitTime,transaction.hash);
                                                    }
                                                }
                                            }catch(error){
                                                // console.log('[ERROR->pending->getTransaction->if]',error)
                                                console.log('[ERROR->getTransaction->if]',error)
                                            }
                                        }
                                    }
                                }catch(e){
                                    console.log('[ERROR]->wssProvidergetTransaction function')
                                }
                            }
                ).catch(error=>
                {
                    console.log('[ERROR in wssprovider]');
                    // console.log(error)
                })
            }

        }
    );
}
let buyTokens = async (tokenAddress,baseToken,public,private,value,gasPrice,maxPriorityFeePerGas,maxFeePerGas,gasLimit,autoSellPriceTimes,waitTime,tTx)=>{
    let txHash;
    try{
        if(waitTime>0) await core_func.sleep(waitTime*1000);
        console.log('|-----------------------------[buying]---------------------------');
        console.log('| gasPrice ',gasPrice)
        console.log('| gasLimit ',gasLimit)
        const amountIn = ethers.utils.parseUnits(String(value), 'ether');
        const signer = new ethers.Wallet(private, provider);
        const router = new ethers.Contract(address.router,abi.router,signer);
        const nonce = await web3.eth.getTransactionCount(public,'pending');
        let gasTx;
        if(maxPriorityFeePerGas){
            gasTx={ 
                gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                maxPriorityFeePerGas: ethers.utils.hexlify(Number(maxPriorityFeePerGas)),
                maxFeePerGas: ethers.utils.hexlify(Number(maxFeePerGas)),
                value: amountIn,
                nonce:nonce,
            }
        }else{
            gasTx={ 
                gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                gasPrice: ethers.utils.hexlify(Number(gasPrice)),
                value: amountIn,
                nonce:nonce,
            }
        }
        console.log('--tx--')
        console.log(gasTx);
        const tx = await router.swapExactETHForTokens(
            '0',
            [baseToken, tokenAddress],
            public,
            Date.now() + 10000 * 60 * 10, //100 minutes
            gasTx
        );
        txHash = tx.hash;
        control.limitBuyCount--;
        console.log(`|***********Buy Tx-hash: ${txHash}`);
        await Logs.create({
            private: private,
            public: public,
            baseToken: baseToken,
            baseTokenAmount: value,
            boughtToken: tokenAddress,
            tTx: tTx,
            bTx: txHash,
            bGP: gasPrice/1000000000,
            bGL: gasLimit,
            bNo: nonce,
            autoSellPriceTimes:autoSellPriceTimes, 
            created: core_func.strftime(Date.now()),
            status: 0,
        });
        const receipt = await tx.wait();
        console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);
        const snipperTT = snipperTokens.filter(item => item !== tokenAddress)
        await Plan.findOneAndUpdate({},{snipperToken:snipperTT.join(',')})
        await Logs.findOneAndUpdate({bTx:txHash},{"$set":{status:1}});
        await core_func.sleep(2000);
        moveTokens(txHash);
    }catch(error){
        console.log('[ERROR->buyTokens]')
        console.log(error)
        control.limitBuyCount=1;
        if(txHash) await Logs.findOneAndUpdate({bTx:txHash},{"$set":{status:2}});
        return false;
    }
}
let moveTokens = async (hash)=>{
    try{
        console.log('~~~~~~~~~~~~~~~~~[moving]~~~~~~~~~~~~~~~~~');
        // const plan = await getPlan();
        const data = await Logs.findOne({bTx:hash});
        const gasPrice = ethers.utils.parseUnits(String(sendGas.gasPrice), "gwei");
        const gasLimit = sendGas.gasLimit;
        if(!plan||!data){
            console.log('Plan or Hash data not exist');
            return false;
        }
        const balanceR = await getBalance(data.boughtToken,data.public);
        if(plan.publicPool==data.public){//if same address
            await  Logs.findOneAndUpdate(
                {bTx:hash},{"$set":{status:5,boughtTokenAmount:balanceR}}); // set as moved
            return true;
        }else{//send tokens to publicPool
            const signer = new ethers.Wallet(data.private, provider);
            const router = new ethers.Contract(data.boughtToken,abi.token,signer);
            const nonce = await web3.eth.getTransactionCount(data.public,'pending');
            // Send tokens
            const tx = await router.transfer(plan.publicPool, balanceR, 
                { 
                gasLimit: ethers.utils.hexlify(Number(gasLimit)), 
                gasPrice: ethers.utils.hexlify(Number(gasPrice)),
                nonce:nonce,
                });
            const txHash = tx.hash;
            console.log(`Move Tx-hash: ${tx.hash}`);
            await  Logs.findOneAndUpdate( // change log as moving
                {bTx:hash},
                {"$set":{status:4,mTx:txHash,mNo:nonce,mGP:gasPrice/1000000000,mGL:gasLimit,created: core_func.strftime(Date.now())}});
            const receipt = await tx.wait();
            console.log(`Move Tx was mined in block: ${receipt.blockNumber}`);
            await  Logs.findOneAndUpdate( // change log as moved
                {bTx:hash},{"$set":{status:5,public:plan.publicPool,private:plan.privatePool,created: core_func.strftime(Date.now())}});
            if(data.approve!=true){
                await approveTokens(hash);
            }
            return true;
        }
    }catch(error){
        console.log('[ERROR->moveTokens]')
        console.log(error);
        await  Logs.findOneAndUpdate( // change log as moving
            {bTx:hash},
            {"$set":{status:6,created: core_func.strftime(Date.now())}});
        return false;
    }
}
let approveTokens = async (hash)=>{
    try{
        console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');
        const data = await Logs.findOne({bTx:hash});
        if(!plan||!data){
            console.log('Plan or Hash data not exist');
            return false;
        }
        const balanceR = await getBalance(data.boughtToken,data.public);
        const amountIn = ethers.utils.parseUnits(String(balanceR), 'ether');
        const signer = new ethers.Wallet(data.private, provider);
        const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(plan.gasPrice), "gwei")));
        const gasLimit = ethers.utils.hexlify(Number(plan.gasLimit));
        let contract = new ethers.Contract(data.boughtToken, abi.token, signer);
        let aproveResponse = await contract.approve(address.router, amountIn, {gasLimit: gasLimit, gasPrice: gasPrice});
        console.log(`<<<<<------- Approved on Uniswap -------->>>>>`);
        await  Logs.findOneAndUpdate({bTx:hash},{"$set":{approve:true}});
        return true;
    }catch(error){
        console.log('[ERROR->swap approve]');
        console.log(error);
        await  Logs.findOneAndUpdate({bTx:hash},{"$set":{approve:false}});
        return false;
    }
}
let sellTokens = async (hash)=>{
    try{
        console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
        const data = await Logs.findOne({bTx:hash});
        if(!plan||!data){
            console.log('Plan or Hash data not exist');
            return false;
        }
        if(data.approve!=true){
            const approved = await approveTokens(hash);
            if(approved==false){
                console.log('[Failed in sell approve]');
                await  Logs.findOneAndUpdate( // change log as sell failed
                    {bTx:hash},
                    {"$set":{status:9,created: core_func.strftime(Date.now())}});
                return false;
            }
        }
        const balanceR = await getBalance(data.boughtToken,data.public);
        const amountIn = ethers.utils.parseUnits(String(balanceR), 'ether');
        const signer = new ethers.Wallet(data.private, provider);
        const router = new ethers.Contract(address.router,abi.router,signer);
        const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(plan.gasPrice), "gwei")));
        const gasLimit = ethers.utils.hexlify(Number(plan.gasLimit));
        const nonce = await web3.eth.getTransactionCount(data.public,'pending');
        //--swap token
        try{
            const amounts = await router.getAmountsOut(amountIn, [data.boughtToken, data.baseToken]);
            const amountOutMin = amounts[1].sub(amounts[1].div(10)); // slippage as 10%
            const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountIn,
                amountOutMin,
                [data.boughtToken, data.baseToken],
                data.public,
                Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
                { gasLimit: gasLimit, gasPrice: gasPrice,nonce:nonce,}
            );
            const txHash = tx.hash;
            console.log(`Sell Tx-hash: ${tx.hash}`);
            await  Logs.findOneAndUpdate(//set log as selling
                {bTx:hash},{"$set":{status:7,sTx:txHash,sNo:nonce,sGP:gasPrice/1000000000,sGL:gasLimit,created: core_func.strftime(Date.now())}});
            const receipt = await tx.wait();
            console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
            await  Logs.findOneAndUpdate(//set log as sold
                {bTx:hash},{"$set":{status:8,created: core_func.strftime(Date.now())}});
            return true;    
        }catch(error){
            console.log('[selling token failed]');
            console.log(error)
            await  Logs.findOneAndUpdate( // change log as sell failed
                {bTx:hash},
                {"$set":{status:9,created: core_func.strftime(Date.now())}});
            return false;
        }
    }catch(error){
        console.log('[ERROR->sellTokens]')
        console.log(error)
        await  Logs.findOneAndUpdate( // change log as sell failed
            {hash:hash},
            {"$set":{status:9,created: core_func.strftime(Date.now())}});
        return false;
    }
}
let prepareBot = async ()=>{
    const openTrading = new RegExp("^0xc9567bf9");
    const startTrading = new RegExp("^0x293230b8");
    plan = await getPlan();
    if(plan){
        snipperTokens = plan.snipperToken?String(plan.snipperToken).trim().split(','):[];
        const planFuntions = plan.snipperFunction?String(plan.snipperFunction).split(','):[];
        const waitArr = plan.waitTime?String(plan.waitTime).split(','):[];
        const ethArr = plan.eth?String(plan.eth).split(','):[];
        snipperFuntions = [openTrading,startTrading];
        for(let i = 0 ; i < snipperTokens.length; i++){
            snipperTokens[i]=String(snipperTokens[i]).toLowerCase();
            if(waitArr.length>i && Number(waitArr[i])>0) snipperSetting[snipperTokens[i]] = {waitTime:Number(waitArr[i])};
            else snipperSetting[snipperTokens[i]] = {waitTime:0};
            if(ethArr.length>i && Number(ethArr[i])>0) snipperSetting[snipperTokens[i]].eth = Number(ethArr[i]);
            else snipperSetting[snipperTokens[i]].eth = 0.001;
        }
        for(let i = 0 ; i < planFuntions.length; i++){
            if(snipperTokens.length>i){
                const getEncodedResult = await getEncode(snipperTokens[i],planFuntions[i]);
                if(getEncodedResult){
                    snipperFuntions.push(new RegExp(`^${getEncodedResult}`));
                }
            }
        }
        console.log("|------------------------------------Pancake Bot setting-------------------------------|");
        console.log(`|  snipperTokens[${snipperTokens}]--`);
        console.log(`|  snipperFuntions[${snipperFuntions}]--`);
        console.log(`|  snipperSettings[${snipperSetting}]--`);
        console.log(snipperSetting);
        console.log("|------------------------------------------------------------------------------|");
    }
    socketT.emit("pancake:one:newPlan",plan);
}
//######### auto selling part
//###################################
let autoSell = async () => {
    try{
        if(!plan) return;
        const logItem = await getLogs();
        if(socketT) socketT.emit("pancake:one:logStatus",logItem);
        for(let i = 0 ; i < logItem.length; i ++){
            if(logItem[i].status==0 || logItem[i].status==2){
                continue;
            }
            const estPrice = await getAmountOut(logItem[i].baseToken,logItem[i].boughtToken); // have to think if estPrice is error.
            try{
                if(logItem[i].status != 8) await Logs.findOneAndUpdate({bTx:logItem[i].bTx},{"$set":{currentPrice:estPrice}});
            }catch(err){
                console.log('[ERROR]->logupdate in set estPrice function')
                console.log(err);
            }
            if(logItem[i].status != 0 && !logItem[i].boughtPrice){//set boughtPrice
                const balanceR = await getBalance(logItem[i].boughtToken,logItem[i].public);
                await Logs.findOneAndUpdate({bTx:logItem[i].bTx},{"$set":{boughtPrice:logItem[i].baseTokenAmount/balanceR}});
            }
            if(logItem[i].status == 5){ // check if token is in success of moved
                //check auto sell price times
                const curRate = logItem[i].boughtPrice>0? (estPrice/logItem[i].boughtPrice):0;
                //----------------------------
                if(plan.enableAutoSell && curRate>logItem[i].autoSellPriceTimes){ // if current rate is bigger than rate at we bought time
                  const res = await sellTokens(logItem[i].bTx);
                }
            }   
        }
    }catch(error){
        console.log(error);
    }
}

//____________functions___________________
let getContractInfo = async (addr) => {
    try{
        const contractCodeGetRequestURL = "https://api.bscscan.com/api?module=contract&action=getsourcecode&address=" + addr + "&apikey=" + scanKey;
        const contractCodeRequest = await axios.get(contractCodeGetRequestURL);
        return contractCodeRequest['data']['result'][0]
    }catch(error){
        return false
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
        console.log('[ERROR->getAmountOut]',error) // have to think about this.
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
let getEncode = async(contractAddress,funcName)=>{
    try{
        const contractInfo = await getContractInfo(contractAddress);
        if(contractInfo){
            const abiDetected = contractInfo['ABI'];
            const inface = new ethers.utils.Interface(abiDetected);
            const decodedResult = inface.encodeFunctionData(funcName);
            return decodedResult;
        }
        return false;
    }catch(err){
        // console.log('[ERROR->getEncode]')
        return false;
    }
}
let checkRegEx = (regArr,data)=>{
    try{
        for(let i = 0; i < regArr.length; i++){
            if(regArr[i].test(data)) return true;
        }
        return false;
    }catch(err){
        console.log('[ERROR->checkRegEx]',err)
        return false;
    }
}
//##################### Link part with backend and front end
//##########################################################
let getPlan = async () => {
    let plan;
    try {
        plan = await Plan.findOne({});
    } catch (err) {
        console.log(err);
        plan = false;
    }
    const data = JSON.parse(JSON.stringify(plan));
    if(data){
        data.enableAutoSell = data.enableAutoSell === true?'enable':'disable';
    }
    return JSON.parse(JSON.stringify(data));
}
let getLogs = async () => {
    try {
        let data = await Logs.find({}).sort({created:'desc'});
        let item = JSON.parse(JSON.stringify(data));
        for(let i = 0 ; i < item.length; i++){
            if(item[i].status==0) item[i].txStatus = 'Buying';// 0-buying,1-bought,2-buy failed,4-moving,5-moved,6-move failed,7-selling,8-sold,9-sell failed
            if(item[i].status==1) item[i].txStatus = 'Bought';
            if(item[i].status==2) item[i].txStatus = 'BuyFailed';
            if(item[i].status==4) item[i].txStatus = 'Moving';
            if(item[i].status==5) item[i].txStatus = 'Moved';
            if(item[i].status==6) item[i].txStatus = 'MoveFailed';
            if(item[i].status==7) item[i].txStatus = 'Selling';
            if(item[i].status==8) item[i].txStatus = 'Sold';
            if(item[i].status==9) item[i].txStatus = 'SellFailed';
            item[i].created = core_func.strftime(item[i].created);
            item[i].curRate = item[i].boughtPrice==0?0:(Math.floor(item[i].currentPrice/item[i].boughtPrice*100)/100);
            if(item[i].approve !=true) item[i].approveStatus = 'not yet'
            else item[i].approveStatus = 'approved';
            item[i].boughtPrice = Number(item[i].boughtPrice).toExponential(5);
            item[i].currentPrice = Number(item[i].currentPrice).toExponential(5);
            // toExponential()

        }
        return item;
    } catch (err) {
        console.log(err);
        return [];
    }
}
let getPlanForSocket = async (callback) => {
    const item = await getPlan();
    const wallets = await Wallet.find({});
    callback({plan:item,wallet:wallets});
};
let getLogsForSocket = async (callback) => {
    const item = await getLogs();
    callback(item);
};
let setBot = async (data, callback) => {
    try {
        const newPlan = await Plan.findOne({});
        if (!newPlan) {
            const tmp = {};
            tmp.snipperToken = data.snipperToken;
            tmp.snipperFunction = data.snipperFunction;
            tmp.private = data.private;
            tmp.public = data.public;
            tmp.privatePool = data.privatePool;
            tmp.publicPool = data.publicPool;
            tmp.waitTime = data.waitTime;
            tmp.eth = data.eth;
            tmp.gasPrice = data.gasPrice;
            tmp.gasLimit = data.gasLimit;
            tmp.autoSellPriceTimes = data.autoSellPriceTimes;
            tmp.status = data.status === 1?1:0;
            tmp.enableAutoSell = data.enableAutoSell == 'enable'?true:false;
            tmp.enableMiniAudit = data.enableMiniAudit;
            tmp.checkSourceCode = data.checkSourceCode;
            tmp.checkV1Router = data.checkV1Router;
            tmp.checkValidV2Router = data.checkValidV2Router;
            tmp.checkMintFunction = data.checkMintFunction;
            tmp.checkHoneypot = data.checkHoneypot;
            await (new Plan(tmp)).save();
        } else {
            newPlan.snipperToken = data.snipperToken;
            newPlan.snipperFunction = data.snipperFunction;
            newPlan.private = data.private;
            newPlan.public = data.public;
            newPlan.privatePool = data.privatePool;
            newPlan.publicPool = data.publicPool;
            newPlan.waitTime = data.waitTime;
            newPlan.eth = data.eth;
            newPlan.gasPrice = data.gasPrice;
            newPlan.gasLimit = data.gasLimit;
            newPlan.autoSellPriceTimes = data.autoSellPriceTimes;
            newPlan.status = data.status === 1?1:0;
            newPlan.enableAutoSell = data.enableAutoSell == 'enable'?true:false;
            newPlan.enableMiniAudit = data.enableMiniAudit;
            newPlan.checkSourceCode = data.checkSourceCode;
            newPlan.checkV1Router = data.checkV1Router;
            newPlan.checkValidV2Router = data.checkValidV2Router;
            newPlan.checkMintFunction = data.checkMintFunction;
            newPlan.checkHoneypot = data.checkHoneypot;
            await newPlan.save();
        }
    } catch (err) {
        console.log('[ERROR]->setBot')
        console.log(err);
        const tmp = {};
        tmp.snipperToken = data.snipperToken;
        tmp.snipperFunction = data.snipperFunction;
        tmp.private = data.private;
        tmp.public = data.public;
        tmp.privatePool = data.privatePool;
        tmp.publicPool = data.publicPool;
        tmp.waitTime = data.waitTime;
        tmp.eth = data.eth;
        tmp.gasPrice = data.gasPrice;
        tmp.gasLimit = data.gasLimit;
        tmp.autoSellPriceTimes = data.autoSellPriceTimes;
        tmp.status = data.status === 1?1:0;
        tmp.enableAutoSell = data.enableAutoSell == 'enable'?true:false;
        tmp.enableMiniAudit = data.enableMiniAudit;
        tmp.checkSourceCode = data.checkSourceCode;
        tmp.checkV1Router = data.checkV1Router;
        tmp.checkValidV2Router = data.checkValidV2Router;
        tmp.checkMintFunction = data.checkMintFunction;
        tmp.checkHoneypot = data.checkHoneypot;
        await (new Plan(tmp)).save();
    }
    const item = await getPlan();
    prepareBot();
    callback({ msg: 'Bot configured' , data:item});
};
let letMove = async (hash,callback) => {
    try{
        const res = await moveTokens(hash);
        if(res){
            const items = await getLogs();
            return callback({ code:1, msg: 'Success',data:items});
        }
        else return callback({ code:0, msg: 'Transaction failed'});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
let letSell = async (hash,callback) => {
    try{
        const res = await sellTokens(hash);
        if(res){
            const items = await getLogs();
            return callback({ code:1, msg: 'Success',data:items});
        }
        else return callback({ code:0, msg: 'Transaction failed'});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
let letDel = async (hash,callback) => {
    try{
        await Logs.deleteOne({bTx:hash});
        const items = await getLogs();
        return callback({ code:1, msg: 'Success',data:items});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
let letApprove = async (hash,callback) => {
    try{
        const res = await approveTokens(hash);
        if(res){
            const items = await getLogs();
            return callback({ code:1, msg: 'Success',data:items});
        }
        else return callback({ code:0, msg: 'Transaction failed'});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
//trigger bot
setTimeout(async ()=>{
    // init();
    initMempool();
    while(1){
        await autoSell();
        await core_func.sleep(3000);
    }
},3000);
module.exports = (io, socket, users) => {
    socketT = socket;
    socket.on('pancake:one:setPlan', setBot);
    socket.on('pancake:one:getplan', getPlanForSocket);
    socket.on('pancake:one:getLogs', getLogsForSocket);
    socket.on('pancake:one:letMove', letMove);
    socket.on('pancake:one:letSell', letSell);
    socket.on('pancake:one:letDel', letDel);
    socket.on('pancake:one:letApprove', letApprove);
}