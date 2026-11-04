// Compatibility command: never regenerate a different town over the supplied layout.
const {build}=require('./build-ascent-district');
if(require.main===module)console.log(JSON.stringify(build(process.argv[2])));
module.exports={build};
