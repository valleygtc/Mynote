/**
 * main process
 * 作用： 
 * 1. Application menu bar的初始化， 和contextmenu的初始化
 * （相应MenuItem的click，发送ipc到renderer process，由后者进行功能的完成，如：new Notebase, new notebook等 ）；
 * 2. 接受render process的ipc channel “show-contextmenu”，并呼出context menu。
 */

const { app, BrowserWindow } = require('electron');
const { Menu } = require('electron');
const { ipcMain } = require('electron');

const { appMenuTemplate, notebooksbarContextMenuTemplate, 
    sectionsbarContextMenuTemplate, section_state } = require('./appmenu');


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWin


function createWindow() {
    const menu = Menu.buildFromTemplate(appMenuTemplate);
    Menu.setApplicationMenu(menu);

    // Create the browser window.
    mainWin = new BrowserWindow({ width: 800, height: 600 })

    // and load the index.html of the app.
    mainWin.loadFile('index.html')

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWin.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWin = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);


// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWin === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

const notebooksbar_contextmenu = Menu.buildFromTemplate(notebooksbarContextMenuTemplate);
ipcMain.on('show-notebooksbar_contextmenu', (event, arg) => {
    console.log('main process receive message: show-contextmenu. arg: ' + arg);
    const win = BrowserWindow.fromWebContents(event.sender);
    notebooksbar_contextmenu.popup(win);
});


ipcMain.on('get-new-notebook-name', (event, arg) => {
    console.log('main process receive from newnotebook window: ' + arg.name);
    mainWin.webContents.send('new-notebook', { name: arg.name });
});

ipcMain.on('get-notebook-new-name', (event, arg) => {
    console.log('main process receive from renamenotebook window: ' + arg.name);
    mainWin.webContents.send('rename-notebook', { name: arg.name });
});

const sectionsbar_contextmenu = Menu.buildFromTemplate(sectionsbarContextMenuTemplate);
ipcMain.on('show-sectionsbar_contextmenu', (event, arg) => {
    console.log('main process receive message: show-contextmenu. arg: ' + arg);
    const win = BrowserWindow.fromWebContents(event.sender);
    sectionsbar_contextmenu.popup(win);
});

ipcMain.on('get-new-section-name', (event, arg) => {
    console.log('main process receive from newsection window: ' + arg.name);
    if (section_state.witch() === 'sibling') {
        mainWin.webContents.send('new-siblingsection', { name: arg.name });
        section_state.clear();
    }
    else if (section_state.witch() === 'child') {
        mainWin.webContents.send('new-childsection', { name: arg.name });
        section_state.clear();
    }
});

ipcMain.on('get-section-new-name', (event, arg) => {
    console.log('main process receive from renamesection window: ' + arg.name);
    mainWin.webContents.send('rename-section', { name: arg.name });
})

