// Small XML helpers shared by upstream provider parsers.
// =========================================================
// FEEDS GLOBAIS — triagem, não substituem alertas oficiais
// =========================================================

function xmlItems(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    return [...xml.matchAll(re)].map(m => m[1]);
}
function xmlTag(block, tag) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
}
export { xmlItems, xmlTag };
