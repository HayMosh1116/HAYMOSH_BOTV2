const { gmd } = require("../mayel");
const path = require("path");
const fs = require('fs').promises;

function findImageMessage(message) {
    let current = message;
    for (let i = 0; i < 5 && current; i += 1) {
        if (current.imageMessage) return current.imageMessage;
        current = current.ephemeralMessage?.message
            || current.viewOnceMessage?.message
            || current.viewOnceMessageV2?.message
            || current.documentWithCaptionMessage?.message;
    }
    return null;
}

gmd({
    pattern: "url",
    aliases: ["imgurl", "imageurl"],
    react: "🔗",
    category: "uploader",
    description: "Get a direct URL for an image",
}, async (from, Prince, conText) => {
    const { mek, reply, react, getMediaBuffer, uploadToPrinceCdn, uploadToImgBB } = conText;
    const quoted = mek?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const image = findImageMessage(quoted) || findImageMessage(mek?.message);
    if (!image) return reply("Reply to an image with .url, or send .url in the image caption.");

    try {
        const buffer = await getMediaBuffer(image, "image");
        if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("empty image");
        let result;
        try {
            result = await uploadToPrinceCdn(buffer, "image.jpg");
        } catch (primaryError) {
            console.error("PrinceCDN image URL failed:", primaryError.message);
            result = await uploadToImgBB(buffer, "image.jpg");
        }
        if (!result?.url || !/^https?:\/\//i.test(result.url)) throw new Error("upload returned no URL");
        await reply(`🔗 *Image URL:*\n${result.url}`);
        await react("✅");
    } catch (error) {
        console.error("Image URL error:", error);
        await react("❌");
        await reply("❌ Failed to create an image URL. Please try again.");
    }
});

gmd({
    pattern: "princecdn",
    react: "⬆️",
    category: "uploader",
    description: "Upload any file to PrinceCDN",
}, async (from, Prince, conText) => {
    await handleUpload(from, Prince, conText, 'princecdn');
});

gmd({
    pattern: "githubcdn",
    react: "⬆️",
    category: "uploader",
    description: "Upload any file to Github Repo",
}, async (from, Prince, conText) => {
    await handleUpload(from, Prince, conText, 'githubcdn');
});


gmd({
    pattern: "catbox",
    react: "⬆️",
    category: "uploader",
    description: "Upload any file to Catbox",
}, async (from, Prince, conText) => {
    await handleUpload(from, Prince, conText, 'catbox');
});

gmd({
    pattern: "pixhost",
    react: "🖼️",
    category: "uploader",
    description: "Upload images to Pixhost",
}, async (from, Prince, conText) => {
    await handleUpload(from, Prince, conText, 'pixhost');
});

gmd({
    pattern: "imgbb",
    react: "📷",
    category: "uploader",
    description: "Upload images to ImgBB",
}, async (from, Prince, conText) => {
    await handleUpload(from, Prince, conText, 'imgbb');
});

gmd({
    pattern: "pasteboard",
    react: "📋",
    category: "uploader",
    description: "Upload images to Pasteboard",
}, async (from, Prince, conText) => {
    await handleUpload(from, Prince, conText, 'pasteboard');
});

async function handleUpload(from, Prince, conText, service) {
    const { mek, reply, react, botFooter, botPrefix, quoted, getMediaBuffer, uploadToPrinceCdn, uploadToGithubCdn, uploadToPixhost, getFileContentType, uploadToImgBB, uploadToPasteboard, uploadToCatbox, pushName } = conText;

    if (!quoted) {
        return reply(`⚠️ Please reply to/quote a media message.`);
    }
    
    const quotedMsg = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        return reply(`⚠️ No quoted message found.`);
    }

    const quotedImg = quotedMsg?.imageMessage || quotedMsg?.message?.imageMessage;
    const quotedVideo = quotedMsg?.videoMessage || quotedMsg?.message?.videoMessage;
    const quotedAudio = quotedMsg?.audioMessage || quotedMsg?.message?.audioMessage;
    const quotedSticker = quotedMsg?.stickerMessage || quotedMsg?.message?.stickerMessage;
    const quotedDocument = quotedMsg?.documentMessage || quotedMsg?.message?.documentMessage;

    try {
        let buffer;
        let fileExt = '';
        let fileName = 'file';
        let isImage = false;
        let mimetype;
        let mediaType;

        if (quotedImg) {
            buffer = await getMediaBuffer(quotedImg, "image");
            fileExt = '.jpg';
            fileName = `image${fileExt}`;
            isImage = true;
            mimetype = "image/jpeg";
            mediaType = 'image';
        } 
        else if (quotedVideo) {
            if (service !== 'catbox' && service !== 'princecdn' && service !== 'githubcdn') {
                return reply(`❌ ${service} only supports images. Use ${botPrefix}catbox or ${botPrefix}princecdn or ${botPrefix}githubcdn  for videos and any other file type.`);
            }
            buffer = await getMediaBuffer(quotedVideo, "video");
            fileExt = '.mp4';
            fileName = `video${fileExt}`;
            mimetype = "video/mp4";
            mediaType = 'video';
        } 
        else if (quotedAudio) {
            if (service !== 'catbox' && service !== 'princecdn' && service !== 'githubcdn') {
                return reply(`❌ ${service} only supports images. Use ${botPrefix}catbox or ${botPrefix}princecdn or ${botPrefix}githubcdn  for audios and any other file type.`);
            }
            buffer = await getMediaBuffer(quotedAudio, "audio");
            fileExt = '.mp3';
            fileName = `audio${fileExt}`;
            mimetype = "audio/mpeg";
            mediaType = 'audio';
        } 
        else if (quotedSticker) {
            if (service === 'pixhost') {
                return reply(`❌ ${service} does not support sticker uploads. Use ${botPrefix}imgbb, ${botPrefix}pasteboard, ${botPrefix}catbox or ${botPrefix}princecdn or ${botPrefix}githubcdn  instead.`);
            }
            buffer = await getMediaBuffer(quotedSticker, "sticker");
            fileExt = '.webp';
            fileName = `sticker${fileExt}`;
            isImage = true;
            mimetype = "image/webp";
            mediaType = 'sticker';
        } 
        else if (quotedDocument) {
            if (service !== 'catbox' && service !== 'princecdn' && service !== 'githubcdn') {
                return reply(`❌ ${service} only supports images. Use ${botPrefix}catbox or ${botPrefix}princecdn or ${botPrefix}githubcdn  for documents and any other file type.`);
            }
            buffer = await getMediaBuffer(quotedDocument, "document");
            fileExt = quotedDocument.fileName ? path.extname(quotedDocument.fileName).toLowerCase() : '.bin';
            fileName = quotedDocument.fileName || `document${fileExt}`;
            mimetype = getFileContentType(fileExt);
            mediaType = 'document';
        } else {
            return reply(`❌ Unsupported message type.`);
        }

        if (!isImage && service !== 'catbox' && service !== 'princecdn' && service !== 'githubcdn') {
            return reply(`❌ ${service} only supports image files. Use ${botPrefix}catbox or ${botPrefix}princecdn or ${botPrefix}githubcdn for any other file types.`);
        }

        let uploadResult;
        switch (service) {
            case 'princecdn':
                uploadResult = await uploadToPrinceCdn(buffer, fileName);
                break;
            case 'catbox':
                uploadResult = await uploadToCatbox(buffer, fileName);
                break;
             case 'githubcdn':
                uploadResult = await uploadToGithubCdn(buffer, fileName);
                break;
            case 'pixhost':
                uploadResult = await uploadToPixhost(buffer, fileName);
                break;
            case 'imgbb':
                uploadResult = await uploadToImgBB(buffer, fileName);
                break;
            case 'pasteboard':
                uploadResult = await uploadToPasteboard(buffer, fileName);
                break;
            default:
                throw new Error('Invalid upload service');
        }

        const fileSizeMB = buffer.length / (1024 * 1024);
        const fileTypeName = fileExt ? fileExt.replace('.', '').toUpperCase() : 'UNKNOWN';
        
        const caption = `Hey *${pushName},*\nHere is Your *${service.toUpperCase()}* Upload Result:\n\n*File Type:* ${fileTypeName}\n*File Size:* ${fileSizeMB.toFixed(2)} MBs\n*File Url:* ${uploadResult.url}\n*File Expiration:* No Expiry\n\n> *${botFooter}*`;

        let messageOptions = { 
            caption: caption,
            quoted: mek
        };

        if (mediaType === 'image' && mimetype !== 'image/webp') {
            messageOptions.image = buffer;
            messageOptions.mimetype = mimetype;
        } else if (mediaType === 'video') {
            messageOptions.video = buffer;
            messageOptions.mimetype = mimetype;
        } else if (mediaType === 'audio') {
            // Audio will only send caption without media
            messageOptions.text = caption;
            delete messageOptions.caption;
        } else if (mediaType === 'document') {
            messageOptions.document = buffer;
            messageOptions.mimetype = mimetype;
            messageOptions.fileName = fileName;
        } else if (mediaType === 'sticker' || mimetype === 'image/webp') {
            // Sticker will only send caption without media
            messageOptions.text = caption;
            delete messageOptions.caption;
        }

        await Prince.sendMessage(from, messageOptions);
        await react("✅");
        
    } catch (error) {
        console.error("Upload Error:", error);
        await reply(`❌ Failed to upload to ${service}. Error: ${error.message}`);
        await react("❌");
    }
}
