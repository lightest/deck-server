import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";
import { graphql, buildSchema } from "graphql";

// Temporary data store:
let data = {};

function readDataStore()
{
    try
    {
        const dataJSON = fs.readFileSync("./data.json");
        data = JSON.parse(dataJSON);
    }
    catch (err)
    {
        console.error("Caught an error, while reading data store", err);
    }
}

const MESSAGE_HANDLERS = {
    "api-request": (msg) =>
    {
        let response = {};

        if (msg.request === "slides")
        {
            const talkId = msg.talkId;
            const talksData = data[ talkId ];
            const slidesData = talksData.slides || [];
            response = slidesData;
        }

        return response;
    }
};

function sendResponse(ws, requestId, data)
{
    try
    {
        const msg = {
            id: requestId,
            response: data
        };
        ws.send(JSON.stringify(msg));
    }
    catch (err)
    {
        console.error("Caught an err while trying to send response", err);
    }
}

function handleMessage(ws, data, isBinary)
{
    console.log("Received:", data);
    try
    {
        console.log(typeof data, isBinary);
        if (!isBinary)
        {
            const message = JSON.parse(data);
            if (MESSAGE_HANDLERS[ message.type ] !== undefined)
            {
                const result = MESSAGE_HANDLERS[ message.type ](message);
                sendResponse(ws, message.id, result);
            }
            console.log("message:", message);
        }
    }
    catch (err)
    {
        console.error("Caught an err while trying to JSON.parse on data", err);
    }
}

function heartbeat()
{
    this.isAlive = true;
}

function handleClientClose(e)
{
    console.log("Client socket disconnected", e);
}

function startWssServer()
{
    const wss = new WebSocketServer({
        port: 29756,
        perMessageDeflate: {
            zlibDeflateOptions: {
                chunkSize: 1024,
                memLevel: 7,
                level: 3
            },
            zlibInflateOptions: {
                chunkSize: 10 * 1024
            },
            // Other options settable:
            clientNoContextTakeover: true, // Defaults to negotiated value.
            serverNoContextTakeover: true, // Defaults to negotiated value.
            serverMaxWindowBits: 10, // Defaults to negotiated value.
            // Below options specified as default values.
            concurrencyLimit: 10, // Limits zlib concurrency for perf.
            threshold: 1024 // Size (in bytes) below which messages
            // should not be compressed if context takeover is disabled.
        }
    });

    wss.on("connection", function connection(ws) {
        ws.on("error", console.error);
        ws.on("message", (data, isBinary) =>
        {
            handleMessage(ws, data, isBinary);
        });
        ws.on("pong", heartbeat);
        ws.on("close", handleClientClose);
    });

    wss.on("close", function close() {
        clearInterval(heartBeatInterval);
    });

    const heartBeatInterval = setInterval(function ping() {
        wss.clients.forEach(function each(ws) {
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    console.log("LET'S GO!");
}

function init()
{
    readDataStore();
    startWssServer();
}

init();
