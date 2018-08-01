/**
 * main renderer process
 * 作用： 
 * 1. render HTML；
 * 2. 接受main process的功能请求，完成相应的database manipulate，并更新render HTML。
 */

const { ipcRenderer, remote } = require('electron');

const { new_notebase, open_db, close_db, insert_node, delete_node, delete_node_children, update_node,
    query_last_notebook,
    query_all_subsections_by_order, query_last_section
} = require('./dbutils');

const { derender_notebooksbar, create_notebook_li_component, find_last_notebook_li, find_active_notebook_li,
    create_sectionbox, create_section_li_component, create_dropdown_button,
    derender_sectionsbar, render_sections_in, insertAfter,
    find_parent_section_li, find_subsectionbox_of, find_sectionbox_of, find_active_section_li, find_first_section_li_in,
    find_parent_section_li_of_sectionbox } = require('./domutils');

const { render_notebooks_from, insert_section_in, adjust_li_sequence, adjust_lis_level_of_sectionbox, 
    adjust_lis_parentnodeid_of_sectionbox } = require('./dbdom_bind_utils');

/*global variable*/
log = console.log;
global.constant = {};
global.constant.dbpath = '';



/* bind native DOM event handler */
//dragbar dragging
let dragging = false;
let dragbar = document.getElementById('dragbar');
dragbar.addEventListener('mousedown', event => {
    dragging = true;
});
document.addEventListener('mousemove', event => {
    if (dragging) {
        page_percent = event.pageX / window.innerWidth;
        sidebar_percent = 1 - page_percent;
        page = document.getElementById('page-container');
        sidebar = document.getElementById('sections-bar');
        page.style.width = (page_percent * 100) + '%';
        sidebar.style.width = (sidebar_percent * 100) + '%';
    }
});
document.addEventListener('mouseup', event => {
    if (dragging) {
        dragging = false;
    }
});

//button active change color
//notebooks-bar
let notebooks_bar = document.getElementById('notebooks-bar');
notebooks_bar.addEventListener('click', event => {
    if (event.target.nodeName !== 'LI') {
        return;
    }

    let notebook_lis = notebooks_bar.getElementsByClassName('notebook');
    for (let i = 0, length = notebook_lis.length; i < length; i++) {
        notebook_lis[i].classList.remove('active');
    }
    event.target.classList.add('active');

    //display sections-bar
    const bar = document.querySelector('#sections-bar');
    bar.style.display = 'block';
    //render 相应sections
    const db = open_db(global.constant.dbpath);
    derender_sectionsbar();
    const notebook_node_id = event.target.dataset.node_id;
    query_all_subsections_by_order(db, notebook_node_id, (subsections) => {
        const box = create_sectionbox(1, notebook_node_id);
        render_sections_in(subsections, box);
        bar.appendChild(box);
    });

    close_db(db);
    //display page-container。
    let page = document.querySelector('#page-container');
    page.style.display = 'block';
    //TODO: render 相应page

});


//1. right click also active. 2. bind contextmenu to notebooks_bar.
notebooks_bar.addEventListener('contextmenu', event => {
    if (event.target.nodeName === 'LI') {
        //add class="active"
        let notebooks = notebooks_bar.getElementsByClassName('notebook');
        for (let i = 0, length = notebooks.length; i < length; i++) {
            notebooks[i].classList.remove('active');
        }
        event.target.classList.add('active');
    }

    //ask main process to pop contextmenu
    event.preventDefault();
    ipcRenderer.send('show-notebooksbar_contextmenu');
})

//使用自定义event来完成drag and drop后database和DOM更新。使用其他方法的话会有依赖问题很难受。
notebooks_bar.addEventListener('adjust-all-notebooks', event => {
    console.log('enter event adjust-all-notebooks event handler');
    let db = open_db(global.constant.dbpath);
    let first_notebook_li = document.querySelector('#notebooks-bar ul li');
    adjust_li_sequence(db, first_notebook_li, 1);
    close_db(db);
})
//改进: drag and drop 改变 notebooks sequence，默认是放到drop target的前边，故无法将li挪到最后一个。
//改进: drag and drop 改变 section sequence，默认是放到drop target的前边，故无法将li挪到最后一个。

//sections-bar
let sections_bar = document.getElementById('sections-bar');
sections_bar.addEventListener('click', event => {
    if (event.target.nodeName === 'LI') {
        let sections = sections_bar.getElementsByClassName('section');
        for (let i = 0, length = sections.length; i < length; i++) {
            sections[i].classList.remove('active');
        }
        event.target.classList.add('active');
    }
    else if (event.target.nodeName === 'BUTTON') {
        const b = event.target;
        const parent_li = b.parentElement;
        if (b.textContent === '+') {
            const db = open_db(global.constant.dbpath);
            query_all_subsections_by_order(db, parent_li.dataset.node_id, (subsections) => {
                const box = create_sectionbox(Number(parent_li.dataset.level) + 1, parent_li.dataset.node_id);
                insertAfter(box, parent_li);
                render_sections_in(subsections, box);
            });
            close_db(db);
            b.textContent = '-';
        }
        else if (b.textContent === '-') {
            parent_li.parentElement.removeChild(find_subsectionbox_of(parent_li));
            b.textContent = '+';
        }

    }

});

sections_bar.addEventListener('contextmenu', event => {
    if (event.target.nodeName === 'LI') {
        //add class="active"
        let sections = sections_bar.getElementsByClassName('section');
        for (let section of sections) {
            section.classList.remove('active');
        }
        event.target.classList.add('active');
    }

    //ask main process to pop contextmenu
    event.preventDefault();
    ipcRenderer.send('show-sectionsbar_contextmenu');
});

//使用自定义event来完成drag and drop之后的DOM，database的更新操作。
//在sctions-bar绑定event handler，但是是在相应的subsection-box上触发的
sections_bar.addEventListener('adjust-all-sections', event => {
    console.log('enter event adjust-all-sections event handler');
    let box = event.target;
    let db = open_db(global.constant.dbpath);
    //adjust all sections' sequence。
    let first_section_li = find_first_section_li_in(box);
    if (first_section_li) {
        adjust_li_sequence(db, first_section_li, 1);
        adjust_lis_level_of_sectionbox(db, box);
        adjust_lis_parentnodeid_of_sectionbox(db, box);
    }

    //如果box中没有了sebsection。则更新parent section（database和HTML），并从DOM中删除自己。
    else if (Number(box.dataset.level) >= 2) {
        let pare_secli = find_parent_section_li_of_sectionbox(box);
        //database update.
        update_node(db, pare_secli.dataset.node_id, [{ name: 'has_child', value: 0 }]);

        //DOM update：去除parent section的button
        pare_secli.dataset.has_child = 0;
        let b = pare_secli.querySelector('button');
        pare_secli.removeChild(b);
        //            去除parent section的subsection-box
        find_sectionbox_of(pare_secli).removeChild(box);
    }
    close_db(db);    
});



/* bind ipc event handler：receive from main process and deal */
/**notebook-bar render相关。
 * 重要的Object：　notebook。至少有属性： node_id, name, has_child, sequence来供render。
 */
ipcRenderer.on('new-notebase', (event, arg) => {
    console.log('receive a message, channel: new-notebase. arg: ' + arg);
    let options, filepath;
    options = {
        title: 'New a notebase',
        defaultPath: 'Untitle.sqlite3'
    }
    filepath = remote.dialog.showSaveDialog(options);
    if (filepath) {
        console.log('Save to file: ' + filepath);
        new_notebase(filepath);
    }
});

ipcRenderer.on('open-notebase', (event, arg) => {
    console.log('receive a message, channel: open-notebase. arg: ' + arg);
    let options, filepath;
    options = {
        title: 'Open a notebase file',
    }
    filepath = remote.dialog.showOpenDialog(options);
    if (filepath) {
        console.log('Open file path: ' + filepath[0]);
        global.constant.dbpath = filepath[0];

        let db = open_db(filepath[0]);
        //display notebooks-bar
        let bar = document.querySelector('#notebooks-bar');
        bar.style.display = 'block';
        //render notebooks li from db
        derender_notebooksbar();
        render_notebooks_from(db);
        close_db(db);
    }
});

ipcRenderer.on('new-notebook', (event, arg) => {
    console.log('receive a message, channel: new-notebook. arg: ' + arg);
    const db = open_db(global.constant.dbpath);
    const name = arg.name;

    db.serialize(() => {
        //database operation: 
        let li = find_last_notebook_li();
        insert_node(db, name, 0, null, 0, Number(li.dataset.sequence) + 1, '');

        //HTML operation
        query_last_notebook(db, notebook => {
            let new_li = create_notebook_li_component(notebook);
            insertAfter(new_li, li);
        })

    })
    close_db(db);
});

ipcRenderer.on('delete-active-notebook', (event, arg) => {
    console.log('receive a message, channel: delete-active-notebook. arg: ' + arg);

    const active_li = find_active_notebook_li();
    if (active_li === null) {
        console.error('delete-active-notebook failed: active notebook not found.');
    }
    const options = {
        type: 'question',
        title: 'Notebook delete',
        message: "确认删除Notebook: " + active_li.textContent,
        buttons: ['Yes', 'No']
    }
    remote.dialog.showMessageBox(remote.getCurrentWindow(), options, (respose_index) => {
        if (respose_index !== 0) {
            return;
        }

        const db = open_db(global.constant.dbpath);
        db.serialize(() => {
            //database operation： delete 该notebook record 及 其subsections.
            delete_node(db, Number(active_li.dataset.node_id));
            delete_node_children(db, Number(active_li.dataset.node_id));

            //update HTML and database：将要删除的li之后的sibling的sequence改正。
            adjust_li_sequence(db, active_li.nextElementSibling,
                Number(active_li.nextElementSibling.dataset.sequence) - 1);
        });

        close_db(db);

        //HTML update: delete from HTML DOM
        active_li.parentElement.removeChild(active_li);
        derender_sectionsbar();
    })
});

ipcRenderer.on('rename-notebook', (event, arg) => {
    let newname = arg.name;
    let active_li = find_active_notebook_li();
    if (active_li === null) {
        console.error('rename-notebook failed: active notebook not found');
    }
    active_li.textContent = newname;
    let db = open_db(global.constant.dbpath);
    update_node(db, active_li.dataset.node_id, [{ name: 'name', value: newname }]);
    close_db(db);
});


/**sections-bar render相关。
 * 重要的Object：　section：必须要有属性： node_id, name, level, parent_node_id, has_child, sequence以供render
 */
ipcRenderer.on('new-siblingsection', (event, arg) => {
    console.log('receive a message, channel: new-siblingsection. arg: ' + arg);
    const db = open_db(global.constant.dbpath);
    const name = arg.name;
    let active_sectionli = find_active_section_li();
    //如果没有active section， 那么就插入到最上层section。
    if (active_sectionli) {
        let active_sectionbox = find_sectionbox_of(active_sectionli);
        insert_section_in(db, name, active_sectionbox);
    }
    else {
        //没有active section， 默认插入到active notebook下的level 1 sectionbox的末尾。
        let nb_li = find_active_notebook_li();
        let nbd = nb_li.dataset;
        let active_sectionbox = find_subsectionbox_of(nb_li);
        //if notebook doesn't have child.....if has child ......
        if (nbd.has_child === '0') {
            insert_section_in(db, name, active_sectionbox);
            //change notebook
            nbd.has_child = 1;
            update_node(db, nbd.node_id, [{ name: 'has_child', value: 1 }]);
        }
        else {
            insert_section_in(db, name, active_sectionbox);
        }
    }
    close_db(db);
});

ipcRenderer.on('new-childsection', (event, arg) => {
    console.log('receive a message, channel: new-childsection. arg: ' + arg);
    const db = open_db(global.constant.dbpath);
    const name = arg.name;

    let active_sectionli = find_active_section_li();
    let asd = active_sectionli.dataset

    //优化: 可不可以改成在DOM中去搜索得到last subsection的sequence， 不要从数据库中得到？有没这必要？
    //注： 如果想要改为从DOM上找到last subsection的sequence就要保证即使没有dropdown下来，也能找到。
    //那么就需要改成在初始化的时候直接render所有的subsection，将其设置为style:none。之后按下dropdown button只是将其style变为:block而已。
    //还是暂时算了。
    if (Number(asd.has_child)) {
        query_last_section(db, Number(asd.level) + 1, asd.node_id, (s) => {
            db.serialize(() => {
                //databse operation.
                insert_node(db, name, s.level, s.parent_node_id, 0, s.sequence + 1, '');

                //HTML update.
                query_last_section(db, s.level, s.parent_node_id, (section) => {
                    const btext = active_sectionli.querySelector('button').textContent;
                    if (btext === '+') {
                        return;
                    }
                    else if (btext === '-') {
                        let li = create_section_li_component(section);
                        active_sectionli.nextElementSibling.appendChild(li);

                    }
                });
            })
            close_db(db);
        })
    }
    else {
        //database update.
        update_node(db, asd.node_id, [{ name: 'has_child', value: 1 }]);

        //DOM update.
        asd.has_child = 1;
        let b = create_dropdown_button()
        active_sectionli.insertBefore(b, active_sectionli.firstChild);
        //database update.
        insert_node(db, name, Number(asd.level) + 1, asd.node_id, 0, 1, '');
        close_db(db);
    }

});

ipcRenderer.on('delete-active-section', (event, arg) => {
    console.log('receive a message, channel: delete-active-section. arg: ' + arg);

    const active_section_li = find_active_section_li();
    const asd = active_section_li.dataset;
    if (active_section_li === null) {
        console.error('no active section');
    }
    const options = {
        type: 'question',
        title: 'Section delete',
        message: "确认删除Section: " + active_section_li.textContent,
        buttons: ['Yes', 'No']
    }
    remote.dialog.showMessageBox(remote.getCurrentWindow(), options, (respose_index) => {
        if (respose_index !== 0) {
            return;
        }
        let db = open_db(global.constant.dbpath);
        //database update： delete该section及其subsection的record
        delete_node(db, Number(asd.node_id));
        delete_node_children(db, Number(asd.node_id));


        //更新被删除的section之后sibling section的sequence。（database和HTML）
        adjust_li_sequence(db, active_section_li.nextElementSibling,
            Number(active_section_li.nextElementSibling.dataset.sequence) - 1);

        //如果自己有sebsections，且为展开状态。则DOM update.
        if (active_section_li.dataset.has_child === '1' &&
            active_section_li.querySelector('button').textContent === '-') {
            find_sectionbox_of(active_section_li).removeChild(find_subsectionbox_of(active_section_li));
        }

        //如果自己是parent section的最后一个subsection，则更新parent section（database和HTML）
        if (asd.level > 1 &&
            (active_section_li.nextElementSibling === null && active_section_li.previousElementSibling === null)) {
            let pare_secli = find_parent_section_li(active_section_li);
            //database update.
            update_node(db, pare_secli.dataset.node_id, [{ name: 'has_child', value: 0 }]);

            //DOM update：去除parent section的button
            pare_secli.dataset.has_child = 0;
            let b = pare_secli.querySelector('button');
            pare_secli.removeChild(b);
            //            去除parent section的subsection-box
            find_sectionbox_of(pare_secli).removeChild(find_subsectionbox_of(pare_secli));
        }

        active_section_li.parentElement.removeChild(active_section_li);

        close_db(db);
    })
});

ipcRenderer.on('rename-section', (event, arg) => {
    let newname = arg.name;
    let active_li = find_active_section_li();
    if (active_li === null) {
        console.error('rename-section failed: active section li not found');
    }

    active_li.textContent = newname;
    let db = open_db(global.constant.dbpath);
    update_node(db, active_li.node_id, [{ name: 'name', value: newname }]);
    close_db(db);
});
