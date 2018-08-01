/**内容：
 * appmenu.js 包含了两种menu的template.
 * appmenu_template: Application menu bar
 * contextmenu_template: right click contextmenu
 * 使用：
 * 在我的设计中， main process负责Application menu bar的初始化，负责呼出right click contextmenu。
 * render process需要给main process进行ipc来请求main process 呼出right click contextmenu
 */


const { BrowserWindow } = require('electron');
const { dialog } = require('electron');

const { new_notebase, open_db, insert_node } = require('./dbutils.js');

const appmenu_template = [
    {
        label: 'File',
        submenu: [{
            label: 'New notebase',
            click: (item, focusedWindow) => {
                focusedWindow.webContents.send('new-notebase');
            }
        },
        {
            label: 'Open',
            click: (item, focusedWindow) => {
                focusedWindow.webContents.send('open-notebase');
            }
        },
        {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S'
        }]
    },
    {
        label: 'Edit',
        submenu: [{
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            role: 'undo'
        },
        {
            role: 'redo'
        },
        {
            role: 'separator'
        },
        {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            role: 'copy'
        },
        {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            role: 'cut'
        },
        {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            role: 'paste'
        },
        {
            label: 'Pasteandmatchstyle',
            role: 'pasteandmatchstyle'
        }]
    },
    {
        label: 'View',
        submenu: [{
            label: 'Zoomin',
            role: 'zoomin'
        },
        {
            label: 'Zoomout',
            role: 'zoomout'
        },
        {
            label: 'Toggle Full Screen',
            accelerator: (() => {
                if (process.platform === 'darwin') {
                    return 'Ctrl+Command+F';
                } else {
                    return 'F11';
                }
            })(),
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                }
            }
        }]
    },
    {
        label: 'Help',
        submenu: [{
            label: 'About',
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    const options = {
                        type: 'info',
                        title: 'About this appication',
                        buttons: ['Ok'],
                        message: 'Mynote is written by valleygtc.\n \
                        github: https://github.com/valleygtc/Mynote'
                    }
                    dialog.showMessageBox(focusedWindow, options, function () { })
                }
            }
        },
        {
            label: 'Toggle Developer Tools',
            accelerator: (() => {
                if (process.platform === 'darwin') {
                    return 'Alt+Command+I'
                } else {
                    return 'Ctrl+Shift+I'
                }
            })(),
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    focusedWindow.toggleDevTools()
                }
            }
        }]
    }
]

const notebooksbar_contextmenu_template = [
    {
        label: 'New notebook',
        click: (item, focusedWindow) => {
            //open a  new window to ask for new notebook name.
            //new window will use ipc communicate with main process on channel 'get-new-notebook-name', with arg.name.
            const path = './newnotebook.html';
            open_ask_window(path);
        }
    },
    {
        label: 'Delete',
        click: (item, focusedWindow, event) => {
            focusedWindow.webContents.send('delete-active-notebook');
        }
    },
    {
        label: 'Rename',
        click: (item, focusedWindow, event) => {
            //open a new window to ask for notebook new name
            //new window will use ipc communicatwith main process on channel 'get-notebook-new-name'
            const path = './renamenotebook.html'
            open_ask_window(path);
        },
        accelerator: 'F2' //TODO： bug: 按F2没有用啊！！
    }
]

const section_state = {
    waitfor_sibling_newname: false,
    waitfor_child_newname: false,
    to_waitfor_sibling_newname: () => {
        waitfor_sibling_newname = true;
        waitfor_child_newname = false;
    },
    to_waitfor_child_newname: () => {
        waitfor_sibling_newname = false;
        waitfor_child_newname = true;
    },
    clear: () => {
        waitfor_sibling_newname = false;
        waitfor_child_newname = false;
    },
    witch: () => {
        if (waitfor_sibling_newname && waitfor_child_newname) {
            console.error("section state wrong: sibling and child all true");
        }
        if (!waitfor_sibling_newname && !waitfor_child_newname) {
            console.error("section state wrong: sibling and child all false");
        }
        if (waitfor_sibling_newname) {
            return 'sibling';
        }
        else{
            return 'child';
        }
    }

}

const sectionsbar_contextmenu_template = [
    {
        label: 'New Sibling section',
        click: (item, focusedWindow, event) => {
            const path = './newsection.html';
            section_state.to_waitfor_sibling_newname();
            open_ask_window(path);
        }
    },
    {
        label: 'New child section',
        click: (item, focusedWindow, event) => {
            const path = './newsection.html';
            section_state.to_waitfor_child_newname();
            open_ask_window(path);
        }
    },
    {
        label: 'Delete',
        click: (item, focusedWindow, event) => {
            focusedWindow.webContents.send('delete-active-section');
        }
    },
    {
        label: 'Rename',
        click: (item, focusedWindow, event) => {
            const path = './renamesection.html'
            open_ask_window(path);
        }
    }
]

function open_ask_window(htmlfile_path) {
    //open a  new window to ask for <user input>.
    //new window will use ipc communicate with main process on <channel>, with <arg>.
    let win = new BrowserWindow({ width: 400, height: 320 });
    win.on('close', () => { win = null });
    win.loadFile(htmlfile_path);
    win.show();
}

module.exports = {
    appMenuTemplate: appmenu_template,
    notebooksbarContextMenuTemplate: notebooksbar_contextmenu_template,
    sectionsbarContextMenuTemplate: sectionsbar_contextmenu_template,
    section_state: section_state
}
