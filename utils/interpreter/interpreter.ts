
import {   hexlify } from "ethers/lib/utils";

import { ExpressionConfig, rlc } from "rainlang";

import { MAGIC_NUMBERS, decodeRainMetaDocument } from "../meta/cbor";



/**
 * @public
 * Builds sources and constants from a rainlang expression.
 *
 * @param expressionString - rainlang expression
 * @returns sources and constants
 */
export const standardEvaluableConfig = async (
  expression: string
): Promise<ExpressionConfig> => {
  const rainDocumentEncoded = "0xff0a89c674ee7874a40059111f789ced5deb8fdb3612ffdebf825804b8a4676dd6dea6ddebb73eee115c9b14692e87439a036889b6899545479476d73df47fbf992125510fcaf2639ff0876477254a1cfee637c32139a43e7ec1d8ffe01f6327095f8a936fd9492442158960f2eaeb9391b913091de29d1fe90ee34cc732144ccdd854669aa93cc3df398347f00abbe2712ed8739eacb3854ce64c252c5b08a6331e5ebe382ddeaa5622e549042ffe48170a416ac2c03369669fa8c9f23dd4239348dcb04c312ac552c123ac6e96aae5a9fb0c4a89d55c8cd8f8d5277bfd8f91bfd65824f36cd155ed9b7c391569d974a81b6ba52a8d149d159f8dd83765bdf4f393054126ab9cca14529cac780a526422d50e32ae942e3a2a4f437152defac3fe66eafaa3003acf6c25637b85c7926b41159c902e49dbf8143dd32084487c84f82bdd615a2d05cbd23c09792622830c21329012a0480092b3445cd71f3872e516b932ea2f0f02ce45b61fb742b55a07030876b38a9161e79326c17e415df184e5c0106486a111d1e5826981acc8041bb3e91a7e68f9bb3025740771ce0e8222bd7e3828171da0d8d66263cba67ba109175c26b14c2e83550a3036f179cf2f85667f136075d04af66bc663f1dd0c9a627128c9165e5201d0a826c3fba1782f7b9bf23016f48e3f6946b55051f310964d85cee38c4da105111a6e55cb6da13c03611cdb701acca308c4d16854289a11978a0f26b646f103eec8dfa823ca8155121a8a9548746d0b9ed9aaae651cb329d14c46fb198751a857f12ac9c44dd654f8eb448b14740836614bb05080486412a547057b283d5ca8e27c99904a53756d0851e86b1bef6adeb397ab84fa77f478676d44fb710b8cb8c182eb4513c35f11226306789b629784892493a9a850a5e74fd9bfb498e5319ba994e984aff4426519c28a78c61c2d2d5c88f0922eb1586a0a8572501218acba9211988cd725ed84f6590ded43c155a9a64db5a14cc38b966d2ecbead4a3a7f684a290b0aeabbbec4c11aee1c6efc17ea6e228f0d8f92f2205ca2d11fd58014c110b3980afae8070146e19f98da7c6bf0b2c4032cdf44a84722631165b33acc6d0b37005da0641f66f131ae19bae65942de0ef4a75e93c5f8265687cc8443ac86f9909100dca616d5b29d3c2dea1aaf164a81b2129bbf8909401976919c55c081fe1e6735de321755a5df99948484275d84b9225987a3b59f995cbca9e4a4dc816907eba6a358ab35da1294c5166eeb385f3a1b6d0504af1b6ad6c84de5aef61f50a7d05dc84c182186c3f3ea96ac5dd9e1595e5ef58c18ebac3286357446d72559593230f9627688d16e66b0996a0f3695015207bace2250d54c000ca7196db8d660eaafcc14437b007184bf79b58a19f3df8ed7706bb70959e79604cad90e8e4298c9831d0c481c02cf1323612d37cdea4ec77dfbf6666606e4867c3978a8eb19a838bce0a022e781a61180bfd8456b1d88a8a4b1ca1749081049b63dfd22ce1e8e46ceb58e5ac032a680da2544a5ffe1ae01d2f722ab85ec8b8356c7a676c99ee158e9a55d4363e2003a79014f31806d71c408e4d401449d41c20ac19d0ec3158f6066b73aed3e0e61d4fe6f8dc471b71ba0542b58477d120890665e99c056c7cd2afe80d06db78274d99fc195e7acb16bd61b0586aba7ba858de467555741a1e1b7683e2f51886cdfe7914402769927dc020bdc3063d5560eb8256153fa109957d6342a3668db127d810ba8766cf5aeb34b362ec50eb376998b17daf49f26deebcb0d89e51e8b17f7ef2fd339932f6cd2af5da1c8a112cc552a5ebeea89227c47c437cecb4324ee3a934e56ba652d7208c85a059481a7b339ab7de39821c464d12cece4d775ac45083c8d6ab4e4ae2f5a232ac64d48402a7569cc63549b37d00d135db46cdf329b16b96e81f3835f41c420c091e7ecd2e4518f2cbc9abaf5fd84968273ca8dc5973d2f44063639ac6f077d0a0a2c92be8a1b737c86feed9207d5323220d83f1f8d5ab60ca639e809b55b3a67efe2e3202da96b0b3787f7df7033e078446ed986b3c0c15446e5b1ad66166b2498ec0ce5a0f9fa3b6226fb15a43f5ec3b25dd84dd1f69b4f503bf6661cb8a1a5ad29d6ac2c9557adade378d379ed09490d141fde29e76e68f849fdb50f8057bc926ddf1707fecd7e88d861a6f530c8a9ebf649317bb87d07b32f700b177c9e99d1d8d87dbc0b4410c9f9cede27f26674fcffbece84b2a0037e19ca98cc781ce57abb8154715489bbb1d403f24687747ca367e0350c52294eb79796bf9a084cc96de96a588c1fd6379e84eb2c4ee10fd64872e06ebce65fb10ed3d0ae6df17f803ece6d5f9f83c50d74995b1505b0b26cce87605313ec2b05b859a139a36cd521e66b796585254b0834be969f83793f12e5d183c76ecc32cd51c087b3986e588433d403738f604603edcb8a3c4af270f51e7697b2e5f7cce71e583264f9eeb17e5945b6697dfa6949b28464c9e8a533687e811b336b20500febb48d50886ea5704f58c25ea3862dfa0beaec599d4a8c0abb869acc2cbc04c4dfab24c2879244f5301fca7f2c57accd6f41f361f64eb0aa8ae0d92d37476c697ab6ee13b642f9f182c7e5bda56835cf113ccd761652bb0bee6df46625fcbc0d25b4b8a118cb297799cc9555c24528201cd05889f9eb20fe6420876032625245e659108e592c73887072d1573918ed834cfd09218674b49d38c53952db64b7fdad9b0268fd6b03a73b3f3256a15900d485f949c8f788f2f8a0b78cf16abeee105ef9aa8bc6ae5f54b4c5473746f55597040837de3fa328fe3f5518f3be8119584b8f72440b7ba352e758f4ab8662b758da334b02fc1c30553688f23264ee7a7ec86fd97ade1dfef476deda82d00d7abad25bf690d23442c42db8bc16db9cc97a89886333dfad07bd22669cc759078c1ab5ed95adfaea9572647f53e30f5caa4a15ee9cfa65aaa56e0f3038fc31c93b9352632e5b1aa29b7ee798f4ada5549cabffe0a583775f2b3815f824ede1c5570201500cc3e15e87cdaf27af994a6a45003470f77af9a23edd423fca95f95216e701a5fb4674ae80ea864266f44040124bcda497b7c532892f2e6c717d59fd7a06581764849ff34936514b89d428bf7756589fc58d465a76f4c92c5546072586a048f3af74bd633d4db64c0ecc5afcf2fce2b3a8cfc126a9ee1e6afce3c96d733366628088a94afcc56b0e20106ff2d8a6925dc6d308bd5355b719d957b1721e6e86c0026d86c907f90eca9ca9328c8571b658fd47562a4a747b02daef4745b250c081c4a8db98db1d2dab757f56cb0e81bacf0167761fa66c80b4309a2355c92e1ad188c9327544e036db9aff948cac740ca62eeadf472153f477748e7d6e0a5647182147dfbf667dd4567ccb6a5626fb623a7d9261ef4b9f6f70bcc96c362357b31d565eae8d58f06e498412d8a722964d32e2be2b037fbdb0c4f5ae926ee8ac44ca61ae3d824c0a5222b022ed601cc6594429912b40b58e3225246be5fdc488db9ad891831116b6117f434ad393556058e61f10e61714f4eb6e0300409646b19d624649ffbf7f89112ad0eadee293d1abaf192039433ed50440bdc0462cbd5d4da503c5e3f4f4dc95bcc22e8dbaef29e7668175b564056810446cf38b8af02e7a771d323344234d3fcbaadd5a4b6cfecf6f0a27207d297c885e112ccb88c0f2401d53e83fe68cf3374806a5e2e7ece791c64aa35e7a496a058bb792fc61e656279d958bf36cb6f4e4e8026db793976b6c8d8c6ad1947cf937fe671837bd4c69767b7453b827abc65c033d93367e0b31f73e8a907b8f541de9c76dd13ba4b42b720edd1ab3bb70ee7d511279f5a6dea4680f14cb76bb776d47df68dd99fed984e6565358f6fcf18d2f55411c7d59b02f84a6b563675e4760f1dba63f39a675e3d484d16d0f2686e0454a14896e1f35e351560ae93be07c7b5a7efd781e94146f05ae5472d16d071de1575b1b243f0b6272be50131b9b667cfaf81553a0df8556b27bdb3fa8360f154660b688f0c19877e044249f4ffe67c94f50817deab891e77203d32e3ae6228766bcee066387aebfd98ede49a5cf9f7d823aaa190ad059cff481147364486b700233376bd503072ebc6af9888a8795d95320aa0308cbbb91348f7c28970e803aa27f926bb56fdc8e853f60e19869327d73c8d8c6b7d523cebcb9141f83af2641ad69bd0cc4d0cc3ef150cbd93ccdaaecf681f3ea5b0c91b20699d9ad8c0642a139eae1b90e4bad8766f6fcf70a90fc745d0c4858a1e3966935ed066b152ad4c54c761191f34d061557ded23f35606855e9c80133d30899b10db3e156b0c2f280cc1573e7a9ba366f7e1325f6e30b9b95020750a31c452f064580061f2d39f3dd39fd3ecf90dfb92ad5f3c7bf694a38ab93f4915419649abaf74501eb397ec66583866bacbbbeb2df702055bdd874adc1a3f787ac058cd4d28fbe8cd31f6277311226a3e3edb004aa8964b5af278329850a337c03230307852a8f477fcfd89669b43f06a3bc45372c47d796188daaa7d38ac4d4fbf298e97a36474e4cffa9ef9735798f525885bcc722f68cfcd5abc9f682feab8aed9f33cd1729ee089ae5c435861f3ec5e3871fc8c2f55ae198fe7ca58f36f2745c82fcd79d6d335d3109fa6f0c46f274f4d1bd073f64ffd605cb5c121123a0222076546490f6cba672f88a8f9de944193f000ad093a3686154b27daa4bd1352e509c3dec55439c364832b91e2512e668f65393b6c8f949f2bdcca325557b46ba2fcf68373b8d971f1640b6583168b6d618e42edee30bcd9b72fcc79a2a3972c28b02c7acba8d0e191100f9b10bd49df2e4b5af9df95d99b3cf0e2930887d5f61453aadcf5a4a382b753705f2ab84a23914e95ba0cae26c11507d0cbb30c1aca7edf3a07e22d3efb3d3cfb6182335bd59f63466fbab52eaf12ba388ea0869e2b71e37320af1d99874721e6d4866deb7a5b9ce560563bf1b0bfc135d60f5b185ae37b7c6a9bb53354f7be4733380c1a3718e4f72ab140bea562c96582cec59e12915c412cda755026b9045b98a5effff906573067e6ec6a3ac041ab38a263e238fb15defe61726be423e10f76064b0505b8d2ab4ea3b3b79c83401e6713e927a665e5baab99789b99db0fb9919d3ed636d0b46d13eb498f9d8a065ebb26fd5021d8d83e3cbbcab2167e86425e89d6908172beb124c351a95974aa311d6302f3280e4b1f191610ccc8d91a3da23db2c79223e0c5511c1d065071df39e90737c8d9602a341f9bb207ce7fa02a3e8cef3239a36ad58ea72ded707e507950c906a5b816e983df9f39265a23ff77f8293ece2ec5faa5c98b59719996271353bc0b2a5394ff0104351f732aa65a2e31d5b276dcaf9bbb7e70f24275dd4142218b0d10ea8d3980c9b761fb770a017f1bb7cec390afa92ce52b3521bd4da4b60890b64afeea3a86879ae8a55d2621aea4de7fa5da734fe814de430908af4d0113e094ce61c4d40ac75c78ea8ac3bfe2434f77bb17fad3887d3cc7ffc6679bbf04e139f976c7c36ced972026a5d8db9d6b269dd87e5b7f36fc81fa67bceccd46da3d16c0ec00a3b9830c0907118fbaa400c815e0f51e1ac6304a8feb3d94878400a83497ef878f44c5af888fe3cd7c3cbf0d3e9eefc14750cd1d1c098eca7ee804eef0a98450277337f959673a2b92b3f6f61f1a861445181611a9b0131e8513bebd4fc7da266d91fd6a9fd826937b134274904d1067bea1a89dd135e58a70a7ca702ad39baa0940dfd710960a9eaef64a5b744db01fab39a6d7428c801f8edae72c777a53d7de48d302062d35b57dcb685708a32e76cd5acf95fb36cf476c5c7ddb64e4afdaf7552ca7662cf22d9e1834a2e96cfcda07e66977d57b31627fe9df743919b45ff4f11c49990a6b7eadf3151b80d258b23c5011a349daa697d1656057412d3ee77874f5b6f6e5afd486654877d2e94f99199edd45d79daf229e59684a0f18a4a42ecf3c7d5633617a41f969257cce7ccfd89e19c7cbd6352d972cb465d5ce8e83ddad5524911b83d45a613e62678658d26c4837187471f9ab7e2e03292f86ed0cc7efa0f68a44258609b5f9336a17b7b26fba8fc6598dc64676465fa327cb21e106db8bcb49bfb9664d73b5b55635c2c52dbbb42f3e7df17fea371acd011bffe5282f43e495b402706170706c69636174696f6e2f6a736f6e03676465666c617465";

  const dataDecoded = decodeRainMetaDocument(rainDocumentEncoded);

  // Find the correct element related to OPS_META_V1
  const opsMetaMap = dataDecoded.find(
    (elem_) => elem_.get(1) === MAGIC_NUMBERS.OPS_META_V1
  );

  const hexOpsMeta = hexlify(opsMetaMap.get(0));

  return await rlc(expression, hexOpsMeta)
    .then((expressionConfig) => {
      return expressionConfig;
    })
    .catch((error) => {
      throw new Error(JSON.stringify(error, null, 2));
    });
};
