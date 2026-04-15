const express = require("express");
const app = express();
 
const port = process.env.PORT || 3000;
 
app.get("/", (req, res) => {
  const currentTime = new Date().toISOString();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Time Display</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .time { font-size: 28px; font-weight: bold; color: #007bff; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Hello from Azure App Service!</h1>
        <p>Current Time:</p>
        <div class="time">${currentTime}</div>
      </div>
    </body>
    </html>
  `);
});

app.get("/time", (req, res) => {
  const currentTime = new Date().toISOString();
  res.json({ time: currentTime });
});
 
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
 
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});