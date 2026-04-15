const express = require("express");
const app = express();
 
const port = process.env.PORT || 3000;
 
app.get("/", (req, res) => {
  res.send("Hello from Azure App Service!");
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