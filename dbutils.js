/*  database: sqlite3 
*   Table: Nodes (
                node_id integer PRIMARY KEY, 
                name text NOT NULL, 
                level integer NOT NULL, （notebook 的 level为0， 其他section的level从 1 开始）
                parent_node_id integer, 
                has_child integer NOT NULL, （1 for true o for false， 因为sqlite3中没有native Boolean datatype）
                sequence integer NOT NULL, 
                content text
                    )
* 内容： sqlite3 database manipulate utilitys.
*/


let sqlite3 = require('sqlite3').verbose();

function init_db(db) {
    const sql = `CREATE TABLE IF NOT EXISTS Nodes ( 
                            node_id integer PRIMARY KEY, 
                            name text NOT NULL, 
                            level integer NOT NULL, 
                            parent_node_id integer, 
                            has_child integer NOT NULL, 
                            sequence integer NOT NULL, 
                            content text
                        )`;
    db.run(sql, err => {
        if (err) {
            console.error(err.message);
        }
    });
}

function new_notebase(dbPath) {
    let db = new sqlite3.Database(dbPath, sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, err => {
        if (err) {
            console.error(err.message);
        }
    });

    init_db(db);
    close_db(db);
}


function open_db(db_path) {
    console.log('open database: ' + db_path + '.');
    let db = new sqlite3.Database(db_path, sqlite3.OPEN_READWRITE, err => {
        if (err) {
            console.error(err.message);
        }
    });
    return db;
}

function close_db(db) {
    console.log('close database: ' + db.filename + '.');
    db.close();
}

function insert_node(db, name, level, parent_node_id, has_child, sequence, content) {
    /**params: 
     * db: db object return by open_db(dbpath)
     * name:String
     * level: Number
     * parent_node_id: Number or null
     * has_child: Number（1 for true, 0 for false）
     * sequence: Number
     * content: String
     * 注意点： level和sequence为Number，但是从HTML data中取出来为String，如果直接做加减运算的话就不对了（如： '1' + 1 = '11'而非 2 ）。
     *      如果要做加减运算一定要把他们变为Number。。
     */
    db.run(`INSERT INTO Nodes(name, level, parent_node_id, has_child, sequence, content) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, level, parent_node_id, has_child, sequence, content], err => {
            if (err) {
                console.error(err.message);
            }
        });
}

function delete_node(db, node_id) {
    /* params:
    *  db: an opened db object
    * node_id: Number
     */
    sql = `DELETE FROM Nodes WHERE node_id=?;`
    db.run(sql, [node_id], err => {
        if (err) {
            console.error(err.message);
        }
    });
}

function delete_node_children(db, parent_node_id) {
    /* params:
    *  db: an opened db object
    * parent_node_id: Number
     */
    sql = `DELETE FROM Nodes WHERE parent_node_id=?`
    db.run(sql, [parent_node_id], err => {
        if (err) {
            console.error(err.message);
        }
    })
}

function update_node(db, node_id, new_columns) {
    /**params:
     * db: an opened db object return by open_db()
     * node_id: Number
     * new_clomuns: [{name: , value: }, {}, ...]
     */
    for (new_column of new_columns) {
        let sql = `UPDATE Nodes SET ${new_column.name}=${new_column.value} WHERE node_id=${node_id}`;
        db.run(sql, [], err => {
            if (err) {
                console.error(err.message);
            }
        });
    }
}

function query_all_notebooks_by_order(db, callback) {
    /*作用：query all notebooks by order and invoke callback(rows)*/
    const sql = `SELECT node_id, name, has_child, sequence
    FROM Nodes 
    WHERE level=0
    ORDER BY sequence`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err.message);
        }
        callback(rows);
    })
}

function query_last_notebook(db, callback) {
    sql = `SELECT node_id, name, has_child, sequence FROM Nodes WHERE level=0 ORDER BY sequence DESC`
    db.get(sql, (err, row) => {
        if (err) {
            console.error(err.message);
        }
        callback(row);
    });
}

function query_all_subsections_by_order(db, parent_node_id, callback) {
    //return sections Array, 内含 section Object。
    db.all(`SELECT node_id, name, level, parent_node_id, has_child, sequence 
                FROM Nodes WHERE parent_node_id=? ORDER BY sequence`,
                [parent_node_id], (err, rows) => {
                    if (err) {
                        console.error(err.message);
                    }
                    callback(rows);
                });
}

function query_last_section(db, level, parent_nodeid, callback) {
    db.get(`SELECT node_id, name, level, parent_node_id, has_child, sequence 
    FROM Nodes WHERE level=? AND parent_node_id=? ORDER BY sequence DESC`, [level, parent_nodeid], (err, row) => {
        if (err) {
            console.error(err.message);
        }
        callback(row);
    })
}



function weizao_record() {
    let db = open_db('./try.db');
    const notebook_n = 5;
    const sections_n = 7
    let cur_nkid = 0;
    db.serialize(() => {
        for (let i=0, n_seq=1; i<notebook_n; i++, n_seq++){
            insert_node(db, 'Notebook' + (n_seq), 0, null, 1, n_seq, "Notebook's Content!!!!!!");
            cur_nkid += 1;
            for (let j=0, s_seq=1; j<sections_n; j++, s_seq++) {
                insert_node(db, 'Section' + s_seq, 1, cur_nkid, 0, s_seq, "Section's Contenttttt!!!");
            }
            cur_nkid += sections_n;
        }
    });
    close_db(db);
}

module.exports = {
    new_notebase: new_notebase,
    open_db: open_db,
    close_db: close_db,
    insert_node: insert_node,
    delete_node: delete_node,
    delete_node_children: delete_node_children,
    update_node: update_node,

    query_all_notebooks_by_order: query_all_notebooks_by_order,
    query_last_notebook: query_last_notebook,

    query_all_subsections_by_order: query_all_subsections_by_order,
    query_last_section: query_last_section
}
