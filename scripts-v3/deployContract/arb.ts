import * as dotenv from "dotenv";
dotenv.config(); 

export const getArbRainlangString = () => {
    const ARB_RAINLANG_STRING = 
    // Refuse any counterparties other than named . This will be the public key of the bot wallet.
    `allowed-counterparty: ${process.env.BOT_ADDRESS},`+
    ":ensure(equal-to(allowed-counterparty context<0 0>()))"+
    ";" 

    return ARB_RAINLANG_STRING
}
export const getUngatedArbRainlangString = () => {
    const ARB_RAINLANG_STRING = "" 

    return ARB_RAINLANG_STRING
}
