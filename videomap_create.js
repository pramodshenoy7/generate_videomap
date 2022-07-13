require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const convert = require('xml-js');
const fs = require('fs/promises');
var libxmljs = require("libxmljs");

const CLD_MOBILE_VIDEO_PRESET="";
const CLD_VIDEO_FOLDER="";
const CLD_SITEMAP_FOLDER="";

videomap_create();

async function videomap_create(){
    var cld_json={}, urls=[], response, next_cursor, mobile_url, mobile_thumb_url;
    cld_json= {
        "urlset": {
            "_attributes": {
                "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
                "xmlns:video": "http://www.google.com/schemas/sitemap-video/1.1"
            }
        }
    };
    do{
        try{
            //Search for videos that has the Structred Metadata value for 'header' field set
            response = next_cursor?
                await cloudinary.search.expression('folder:'+CLD_VIDEO_FOLDER+'/* AND metadata=header').with_field('metadata').max_results(500).next_cursor(next_cursor).execute():
                await cloudinary.search.expression('folder:'+CLD_VIDEO_FOLDER+'/* AND metadata=header').with_field('metadata').max_results(500).execute()
        }catch(e){console.error(e)}
        response.resources.forEach(element => {
            var tmp = {}, tmp_mobile={};
            // from Search response, parse values for desktop video
            tmp['loc'] = element.metadata['page_url'];
            tmp["video:video"]={};
            tmp["video:video"]["video:thumbnail"] = element.secure_url.replace('.mp4', '.jpg');
            tmp["video:video"]["video:title"] = element.metadata['header'];
            tmp["video:video"]["video:description"] = element.metadata['description'];
            tmp["video:video"]["video:content_loc"] = element.secure_url;
            urls.push(tmp);
            // from Search response, parse values for mobile version of video
            tmp_mobile = JSON.parse(JSON.stringify(tmp))
            mobile_url = element.secure_url.split('upload/');
            tmp_mobile["video:video"]["video:content_loc"] = mobile_url[0]+'upload/t_'+CLD_MOBILE_VIDEO_PRESET+'/'+mobile_url[1];
            mobile_thumb_url = element.secure_url.replace('.mp4', '.jpg').split('upload/');
            tmp_mobile["video:video"]["video:thumbnail"] =  mobile_thumb_url[0]+'upload/t_'+CLD_MOBILE_VIDEO_PRESET+'/'+mobile_thumb_url[1];
            urls.push(tmp_mobile);
        })
        //iterate till no next_cursor returned in Search API response
        next_cursor = response ? response.next_cursor : null
    }while(next_cursor)
    cld_json["urlset"]["url"] = urls;
    var options = {compact: true, ignoreComment: true, spaces: 4};
    //translate JSON to XML
    var cld_xml = convert.json2xml(cld_json, options);
    try{
        // validate XML syntax
        libxmljs.parseXml(cld_xml)
        console.log("XML syntax validated")
        try{
            var file_write = await fs.writeFile('output_xml/video-sitemap.xml', cld_xml);
            console.log("XML write successful")
            var cld_upload = await cloudinary.uploader.upload("output_xml/video-sitemap.xml", {folder: CLD_SITEMAP_FOLDER, resource_type:"auto"})
            console.log("XML upload to Cloudinary successful")
        }catch(err){
            console.error("XML write and upload error: "+ JSON.stringify(err));
        }
    }catch(err){
        console.error("XML syntax not valid");
    }
}