
# steps to make this work

 * import this repo in your local machine

## step get your cookie
- go to https://console.x.ai/playground/imagine?campaign=imagine-landing
- open network tab
- start creating any image you want, 
- search generations in network tab search bar, you will see a url like this
  https://console.x.ai/v1/images/generations (subject to change)
- copy the cookie from request headers, it will look like this
  Cookie : <cookie value> // e.g. sa=....

## step 3 
- create a .env file in the root of the project and add the following line
  VITE_XAI_COOKIE=< cookie value >
- run the following command in the terminal
  npm install
- run the following command to start the UI server
- ```npm start```
- you also need to start a simple nodejs backend server to proxy the requests to the x.ai api, you can use the following code for that
  in a new terminal run this command 
- ```node server.cjs```

## generate 
- now you can go to http://localhost:5173 and start generating images.
thats all....

