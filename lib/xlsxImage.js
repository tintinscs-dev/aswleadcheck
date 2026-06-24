// SheetJS's open-source `xlsx` build cannot write embedded images, so the
// company logo is spliced into the generated .xlsx package by hand via JSZip
// (raw OOXML: a drawing anchored to the first sheet, its relationships, and
// the matching [Content_Types].xml entries).
import JSZip from 'jszip';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export async function embedLogoInXlsx(buffer, logoBuffer, opts = {}) {
  const { sheetIndex = 1, widthEmu = 1900000, heightEmu = 369000 } = opts;
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = `xl/worksheets/sheet${sheetIndex}.xml`;
  let sheetXml = await zip.file(sheetPath).async('string');

  zip.file('xl/media/logo1.png', logoBuffer);

  const drawingXml = XML_HEADER +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>40000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>20000</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
    `<xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
  zip.file('xl/drawings/drawing1.xml', drawingXml);

  zip.file('xl/drawings/_rels/drawing1.xml.rels', XML_HEADER +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo1.png"/>` +
    `</Relationships>`);

  const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
  const existingRelsFile = zip.file(sheetRelsPath);
  let sheetRels = existingRelsFile
    ? await existingRelsFile.async('string')
    : (XML_HEADER + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  const usedIds = [...sheetRels.matchAll(/Id="rId(\d+)"/g)].map(m => Number(m[1]));
  const drawingRid = 'rId' + (Math.max(0, ...usedIds) + 1);
  sheetRels = sheetRels.replace('</Relationships>', `<Relationship Id="${drawingRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
  zip.file(sheetRelsPath, sheetRels);

  if (sheetXml.includes('<drawing ')) {
    sheetXml = sheetXml.replace(/<drawing [^/]*\/>/, `<drawing r:id="${drawingRid}"/>`);
  } else {
    sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${drawingRid}"/></worksheet>`);
  }
  zip.file(sheetPath, sheetXml);

  let ct = await zip.file('[Content_Types].xml').async('string');
  if (!ct.includes('Extension="png"')) {
    ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  }
  if (!ct.includes('drawing+xml')) {
    ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
  }
  zip.file('[Content_Types].xml', ct);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
