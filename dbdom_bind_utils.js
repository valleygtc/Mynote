/**
 * 本文件中的函数同时完成database和DOM操作.
 */


const { query_all_notebooks_by_order, insert_node, query_last_section, update_node
} = require('./dbutils');
const { render_notebooks, create_section_li_component, find_last_section_li_in, find_first_section_li_in } = require('./domutils');

/**
 * notebooks相关
 * 
 */
function render_notebooks_from(db) {
    query_all_notebooks_by_order(db, render_notebooks);
}

/**
 * sections相关
 */

function insert_section_in(db, section_name, sectionbox) {
    /**
     * sectionbox: Node：容纳section_li的ul，必须含有data-level, data-parent_node_id
     * 作用：将new section插入到section_box的末尾， 包含database insert, 和DOM update
     */
    const sbdata = sectionbox.dataset;
    let sequence;
    const s = find_last_section_li_in(sectionbox);
    if (s) {
        sequence = Number(s.dataset.sequence) + 1;
    }
    else {
        sequence = 1;
    }
    db.serialize(() => {
        //database update:
        insert_node(db, section_name, sbdata.level, sbdata.parent_node_id, 0, sequence, '');
        //DOM update:
        query_last_section(db, sbdata.level, sbdata.parent_node_id, section => {
            let li = create_section_li_component(section);
            sectionbox.appendChild(li);
        });
    });
}

function adjust_li_sequence(db, start_li, right_sequence) {
    /*params:
    * start_li: Node
    * right_sequence: Number
    *功能： 更新start_li及其nextElementSibling li的sequence。（database和HTML）
    */
    let li = start_li;
    while (li) {
        let lid = li.dataset;
        if (lid.sequence != right_sequence) {
            //HTML
            lid.sequence = right_sequence;

            //database
            update_node(db, lid.node_id, [{ name: 'sequence', value: Number(lid.sequence) }]);
        }
        right_sequence += 1;
        li = li.nextElementSibling;
    }
}

function adjust_lis_level_of_sectionbox(db, sectionbox) {
    /*params:
    * db: open_db() return's db object
    * sectionbox: Node
    *功能： 更新start_li及其nextElementSibling li的sequence。（database和HTML）
    */
    let li = find_first_section_li_in(sectionbox);
    let sbd = sectionbox.dataset;
    while (li) {
        let lid = li.dataset;
        if (lid.level != sbd.level) {
            //HTML
            lid.level = sbd.level;

            //database
            update_node(db, lid.node_id, [{ name: 'level', value: Number(lid.level) }]);
        }
        li = li.nextElementSibling;
    }
}

function adjust_lis_parentnodeid_of_sectionbox(db, sectionbox) {
    /*params:
    * db: open_db() return's db object
    * sectionbox: Node
    *功能： 更新start_li及其nextElementSibling li的sequence。（database和HTML）
    */
    let li = find_first_section_li_in(sectionbox);
    let sbd = sectionbox.dataset;
    while (li) {
        let lid = li.dataset;
        if (lid.parent_node_id != sbd.parent_node_id) {
            console.log('adjust node: ' + lid.node_id + 'parent_node_id from: ' + lid.parent_node_id + ' -> ' + sbd.parent_node_id);
            //HTML
            lid.parent_node_id = sbd.parent_node_id;

            //database
            console.log('database adjust node: ' + lid.node_id + ' -> ' + lid.parent_node_id);
            update_node(db, lid.node_id, [{ name: 'parent_node_id', value: Number(lid.parent_node_id) }]);
        }
        li = li.nextElementSibling;
    }
}

module.exports = {
    render_notebooks_from: render_notebooks_from,
    insert_section_in: insert_section_in,
    adjust_li_sequence: adjust_li_sequence,
    adjust_lis_level_of_sectionbox: adjust_lis_level_of_sectionbox,
    adjust_lis_parentnodeid_of_sectionbox: adjust_lis_parentnodeid_of_sectionbox
}
