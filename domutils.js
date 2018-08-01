/**
 * 本文件中的函数完成DOM的render, drender, create component, find, component操作。
 */

/**notebooks相关：
 * 
 */

function derender_notebooksbar() {
    const ul = document.querySelector('#notebooks-bar ul');
    if (ul.childElementCount === 0) {
        return;
    }
    for (let length = ul.children.length, i = length - 1; i >= 0; i--) {
        ul.removeChild(ul.children[i]);
    }
}

function render_notebooks(notebooks) {
    /* params: notebooks为一个按sequence升序排序的Array， 其中每一个item为一个notebook Object，
    *           notebook至少有属性： node_id, name, sequence
    *  return: null
    */
    let frag = document.createDocumentFragment();
    for (let notebook of notebooks) {
        let li = create_notebook_li_component(notebook);
        frag.appendChild(li);
    }
    let ul = document.querySelector('#notebooks-bar ul');
    ul.appendChild(frag);
}

function create_notebook_li_component(notebook) {
    /* param: notebook is an object， 至少有属性node_id, name, has_child, sequence
    *  return: li: Node
    * 作用：create and return a li Node, with class="notebook"
    * <li class="notebook" data-node_id="notebook.node_id" data-sequence="notebook.sequence">
    * notebook.name</li>
    *  */
    let li = document.createElement('li');
    li.classList.add('notebook');
    bind_li_drag_handler(li);
    li.dataset.node_id = notebook.node_id;
    li.dataset.sequence = notebook.sequence;
    li.dataset.has_child = notebook.has_child;
    let text = document.createTextNode(notebook.name);
    li.appendChild(text);

    return li;
}

function find_last_notebook_li() {
    let notebook_li_array = document.querySelectorAll('#notebooks-bar ul li.notebook');
    return notebook_li_array[notebook_li_array.length - 1];
}

function find_active_notebook_li() {
    /**
     * return: 如果找到了则返回li Node， 否则返回null
     */
    let li_array = document.querySelectorAll('#notebooks-bar ul li');
    for (let i = 0, length = li_array.length; i < length; i++) {
        if (li_array[i].classList.contains('active')) {
            return li_array[i];
        }
    }
    //if not found
    return null;
}

//li drag 相关
let dragSrcEl = null;
let dragSrcElType = null;
function bind_li_drag_handler(li) {
    li.setAttribute('draggable', 'true');
    li.addEventListener('dragstart', event => {
        let t = event.currentTarget;
        t.classList.add('dragging');
        dragSrcEl = t;
        if (dragSrcEl.classList.contains('notebook')) {
            dragSrcElType = 'notebook';
        }
        else if (dragSrcEl.classList.contains('section')) {
            dragSrcElType = 'section';
        }

        event.dataTransfer.effectAllowed = 'move';
    }, false);
    li.addEventListener('dragenter', function (event) {
        let t = event.currentTarget;
        t.classList.add('dragover');
    }, false);
    li.addEventListener('dragover', function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        return false;
    }, false);
    li.addEventListener('dragleave', function (event) {
        let t = event.currentTarget;
        t.classList.remove('dragover');
    }, false);
    li.addEventListener('drop', function (event) {
        let t = event.currentTarget;
        event.stopPropagation();    // Stops some browsers from redirecting.

        //clear drop li的dragover class。因为该li没有触发dragleave，从而没有clear dragover class的问题。
        t.classList.remove('dragover');

        if (dragSrcEl == t) {
            return false;
        }

        let srcbox = null;
        let targetbox = null;
        if (dragSrcElType === 'section') {
            srcbox = find_sectionbox_of(dragSrcEl);
            targetbox = find_sectionbox_of(t);
        }

        //DOM update: 将src element 插入到drop target的左边
        if (dragSrcElType === 'notebook') {
            t.parentElement.insertBefore(dragSrcEl, t);
        }
        else if (dragSrcElType === 'section') {
            let subsectionbox = find_subsectionbox_of(dragSrcEl);
            if (subsectionbox) {
                t.parentElement.insertBefore(dragSrcEl, t);
                t.parentElement.insertBefore(subsectionbox, t);
            }
            else {
                t.parentElement.insertBefore(dragSrcEl, t);
            }
        }

        //DOM中的data 和 database update request.
        if (dragSrcElType === 'notebook') {
            let bar = document.querySelector('#notebooks-bar');
            bar.dispatchEvent(new Event('adjust-all-notebooks'));
        }
        else if (dragSrcElType === 'section') {
            let e = new Event('adjust-all-sections', { bubbles: true });
            if (srcbox === targetbox) {
                //change sequence, 如果dragSrcEl为其父元素的最后一个subsection，则更新parent_section（DOM， database）
                srcbox.dispatchEvent(e);
            }
            else {//如果跨了section box。
                //change level, parent_node_id sequence（DOM and database）.
                srcbox.dispatchEvent(e);
                targetbox.dispatchEvent(e);
            }
        }

        return false;
    }, false);
    li.addEventListener('dragend', function (event) {
        let t = event.currentTarget;
        t.classList.remove('dragging');
    }, false);
}

/**sections相关
 *
 */

function create_sectionbox(level, parent_node_id) {
    /**
     * sectionbox: Node，内含section_li的ul。必须包含的属性： data-level, data-parent_node_id
     */
    const box = document.createElement('ul');
    box.classList.add('subsection-box');
    box.dataset.level = level;
    box.dataset.parent_node_id = parent_node_id;

    return box;
}

function create_section_li_component(section) {
    /**params: section object：必须要有属性： node_id, name, level, parent_node_id, has_child, sequence
     *  return li: Node
    作用：create and return a li Node, with class="section"
    * <li class="section" 
    *   data-node_id="section.node_id" data-level="section.level"
    *   data-parent_node_id="section.parent_node_id"
    *   data-has_child="section.has_child"
    *   data-sequence="section.sequence">
    *       section.name</li>
    *  */
    let li = document.createElement('li');
    li.classList.add('section');
    li.dataset.node_id = section.node_id;
    li.dataset.level = section.level;
    li.dataset.parent_node_id = section.parent_node_id;
    li.dataset.has_child = section.has_child;
    li.dataset.sequence = section.sequence;
    if (Number(section.has_child)) {
        let b = create_dropdown_button();
        li.appendChild(b);
    }
    let text = document.createTextNode(section.name);
    bind_li_drag_handler(li);
    li.appendChild(text);

    return li;
}

function create_dropdown_button() {
    let b = document.createElement('button');
    let t = document.createTextNode('+');
    b.appendChild(t);

    return b;
}

function derender_sectionsbar() {
    let box = document.querySelector('#sections-bar>ul');
    if (box) {
        box.parentElement.removeChild(box);
    }
}

function render_sections_in(sections, sectionbox) {
    /**
     * params:
     * subsections: Array of section object.
     * sectionbox: Node.
     */
    const frag = document.createDocumentFragment();
    for (let subsection of sections) {
        let li = create_section_li_component(subsection);
        frag.appendChild(li);
    }
    sectionbox.appendChild(frag);
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function find_parent_section_li(section_li) {
    /**params:
     * section_li: Node
     */
    return section_li.parentElement.previousElementSibling;
}

function find_parent_section_li_of_sectionbox(subsectionbox) {
    if (!(Number(subsectionbox.dataset.level) >= 2)) {
        console.error('function find_parent_section_li_of_sectionbox: 要求subsection level 大于等于 2。');
    }
    return subsectionbox.previousElementSibling;
}

function find_subsectionbox_of(li) {
    /**params:
     * li: Node。 可以为notebook li，也可以为section li
     * 
     * return:返回DOM树中的传入参数li的subsectionbox， 如果没有，则返回null。
     */
    if (li.classList.contains('notebook')) {
        return document.querySelector('#sections-bar ul');
    }
    else if (li.classList.contains('section')) {
        if (li.dataset.has_child !== '1') {
            return null;
        }
        let ul = li.nextElementSibling;
        if (ul.nodeName === 'UL') {
            return ul;
        }
    }
    return null;
}

function find_last_section_li_in(section_box) {
    /**params: 
     * section_box: Node
     * return: 如果有则返回li Node, 否则返回null.
     */
    let ele = section_box.lastElementChild;
    if (ele === null) {
        return null;
    }
    else if (ele.nodeName === 'LI') {
        return ele;
    }
    else {
        return ele.previousElementSibling;
    }
}

function find_first_section_li_in(section_box) {
    /**params: 
     * section_box: Node
     * return: 如果有则返回li Node, 否则返回null.
     */
    let ele = section_box.firstElementChild;
    if (ele === null) {
        return null;
    }
    else if (ele.nodeName === 'LI') {
        return ele;
    }
    else {
        return null;
    }
}

function find_sectionbox_of(section_li) {
    return section_li.parentElement;
}

function find_active_section_li() {
    let sections = document.querySelectorAll('#sections-bar ul li');
    for (let section of sections) {
        if (section.classList.contains('active')) {
            return section;
        }
    }
    //if not found
    return null;
}

module.exports = {
    derender_notebooksbar: derender_notebooksbar,
    render_notebooks: render_notebooks,
    create_notebook_li_component: create_notebook_li_component,
    find_last_notebook_li: find_last_notebook_li,
    find_active_notebook_li: find_active_notebook_li,

    create_sectionbox: create_sectionbox,
    create_section_li_component: create_section_li_component,
    create_dropdown_button: create_dropdown_button,
    derender_sectionsbar: derender_sectionsbar,
    render_sections_in: render_sections_in,
    insertAfter: insertAfter,
    find_parent_section_li: find_parent_section_li,
    find_subsectionbox_of: find_subsectionbox_of,
    find_last_section_li_in: find_last_section_li_in,
    find_sectionbox_of: find_sectionbox_of,
    find_active_section_li: find_active_section_li,
    find_first_section_li_in: find_first_section_li_in,
    find_parent_section_li_of_sectionbox: find_parent_section_li_of_sectionbox
}
