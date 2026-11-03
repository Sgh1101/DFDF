// User-provided original gun inputs. Preserve authored geometry, UVs and pixels.
"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const provenance=require("./source-gun/provenance.json");
function files(){
  return provenance.files.map(file=>{
    const bytes=fs.readFileSync(path.join(__dirname,"source-gun",file.name));
    if(bytes.length!==file.size||crypto.createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw Error("Original gun source changed: "+file.name);
    return {name:file.name,bytes};
  });
}
module.exports={files,provenance};
