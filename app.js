const express = require("express");
const axios = require("axios");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

function obtenerNombreCatalogo() {
    const fecha = new Date();

    const mes = fecha.toLocaleString("es-PE", {
        month: "long"
    });

    const nombreMes =
        mes.charAt(0).toUpperCase() +
        mes.slice(1);

    return `Catálogo BBB Importaciones ${nombreMes}.pdf`;
}

async function generarCatalogo() {

    const response = await axios.get(
        "https://apiweb.kallpaprod.pe/api/kallpa/web/v1/producto/catalogoDomain/bbbimportaciones",
        {
            headers: {
                "x-business-subdomain": "bbbimportaciones"
            }
        }
    );

    const whatsappBase64 = fs.readFileSync(
        path.join(__dirname, "assets", "wasap.png"),
        {
            encoding: "base64"
        }
    );

    const data = response.data.data;
    const business = data.business;
    const productos = data.productKatalago;

    // IDs de productos que siempre deben ir al final
    const PRODUCTOS_AL_FINAL = [
        "7fa18106-5f0c-4045-9778-2e59c703d44d"
    ];

    const productosNormales = productos.filter(
        p => !PRODUCTOS_AL_FINAL.includes(p.id)
    );

    const productosFinales = productos.filter(
        p => PRODUCTOS_AL_FINAL.includes(p.id)
    );

    const productosOrdenados = [
        ...productosNormales,
        ...productosFinales
    ];

    let template = fs.readFileSync(
        path.join(__dirname, "templates", "catalogo.html"),
        "utf8"
    );

    let css = fs.readFileSync(
        path.join(__dirname, "styles", "catalogo.css"),
        "utf8"
    );

    template = template.replace(
        /{{WHATSAPP_ICON}}/g,
        `data:image/png;base64,${whatsappBase64}`
    );

    let productosHtml = "";

    productosOrdenados.forEach(producto => {

        const claseExtra =
            PRODUCTOS_AL_FINAL.includes(producto.id)
                ? "card-completa"
                : "";

        productosHtml += `
        <div class="card ${claseExtra}">

            <div class="contenedor-imagen">
                <img src="${producto.image}" class="imagen">
            </div>

            <div class="contenido">

                <h2>${producto.name}</h2>

                <div class="descripcion">
                    ${producto.description.replace(/\n/g, "<br>")}
                </div>

                <div class="footer">

                    <div class="precio">
                        S/ ${producto.price.toFixed(2)}
                    </div>

                    <div class="stock">
                        Stock: ${producto.stock}
                    </div>

                </div>

            </div>

        </div>
        `;
    });

    template = template
        .replace("{{CSS}}", css)
        .replace("{{LOGO}}", business.logo)
        .replace("{{EMPRESA}}", business.name)
        .replace("{{WHATSAPP}}", business.whatsapp)
        .replace("{{PRODUCTOS}}", productosHtml);

    const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
});

    const page = await browser.newPage();

    await page.setContent(template, {
        waitUntil: "networkidle0"
    });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
            top: "20px",
            bottom: "20px",
            left: "20px",
            right: "20px"
        }
    });

    await browser.close();

    return pdfBuffer;
}

// Ruta principal
app.get("/", async (req, res) => {

    try {

        const pdfBuffer = await generarCatalogo();

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${obtenerNombreCatalogo()}"`
        );

        res.send(pdfBuffer);

    } catch (error) {

        console.error(error);

        res.status(500).send(
            "Error al generar el catálogo"
        );

    }

});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});