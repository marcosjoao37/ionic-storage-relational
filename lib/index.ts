import { Storage } from '@ionic/storage';

/**
 * IField interface
 *
 * @param fromTable   The TABLE NAME that you want to expand / import relational object(s);
 * @param fromColumn  The COLUMN NAME that you want to compare the keys;
 * @param hasOne      Expand from one to one (or n->1);
 * @param hasMany    Expand from one to many (or 1->n);
 * @param byKeyName   Have to be used when isOne is true;
 */
export interface IField {
  fromTable: string,
  fromColumn: string,
  hasOne?: boolean,
  hasMany?: boolean,
  byKeyName?: string
}

export class BaseLocalProvider {
  tableName: string;

  constructor(private storage: Storage, private _tableName: string) {
    this.tableName = _tableName;
  }

  public list(tableName: string = this.tableName, expand?: IField[]) {
    return new Promise<any[]>((resolve, reject) => {
      this.verifyTableExistence(tableName).then(() => {
        this.localStorage()
          .then((storage: Storage) => {
            storage.get(tableName)
              .then((res: any[]) => {
                if (!res) {
                  resolve([]);
                } else {
                  if (expand) {
                    let allPromises: any[] = [];
                    let returnList: any[] = [];
                    res.forEach((item) => {
                      let promises: any[] = [];
                      expand.forEach((itemField: IField) => {
                        let searchId = null;
                        if (itemField && itemField.byKeyName && item[itemField.byKeyName]) {
                          searchId = item[itemField.byKeyName];
                          promises.push(this.getRelationalData(itemField.fromTable, tableName, searchId, itemField.fromColumn, itemField.hasOne, itemField.hasMany));
                        }
                      });
                      let promise = Promise.all(promises);
                      promise
                        .then(res => {
                          res.map(expArr => {
                            item[expArr.key] = expArr.data;
                          });
                          returnList.push(item);
                        })
                        .catch(err => reject(err));
                      allPromises.push(promise);
                    });
                    // ----
                    Promise.all(allPromises)
                      .then(() => {
                        resolve(returnList);
                      })
                      .catch(err => reject(err));
                    // ----
                  } else {
                    resolve(res);
                  }
                }
              })
              .catch(err => reject(err));
          })
          .catch(err => reject(err));
      });
    });
  }

  /**
   * GET function
   *
   * @param tableName The TABLE name that the object was origin saved;
   * @param id        The ID number that the object was origin saved;
   * @param {IField} expand    The expand fields;
   */
  public get(tableName: string = this.tableName, id: number | null, expand?: IField[]) {
    return new Promise<any>((resolve: any, reject: any) => {
      this.verifyTableExistence(tableName).then(() => {
        this.list(tableName)
          .then((list: any[]) => {
            if (!id && id != 0) {
              resolve(null);
            }
            let item = list.find(itemToFind => itemToFind.id == id);
            if (!item) {
              reject({
                message: `Null item; Maybe the item with ID "${id}" doesn\'t exists in table "${tableName}";`,
                res: null
              });
            } else {
              if (expand) {
                let promises: any[] = [];
                expand.forEach((itemField: IField) => {
                  let searchId = null;
                  if (itemField && itemField.byKeyName) {
                    let searchId = item[itemField.byKeyName];
                  }
                  promises.push(this.getRelationalData(itemField.fromTable, tableName, searchId, itemField.fromColumn, itemField.hasOne, itemField.hasMany));
                });
                Promise.all(promises)
                  .then(res => {
                    res.map(expArr => {
                      item[expArr.key] = expArr.data;
                    });
                    resolve(item);
                  })
                  .catch(err => reject(err));
              } else {
                resolve(item);
              }
            }
          })
          .catch(err => reject(err));
      });
    });
  }

  public save(tableName: string = this.tableName, data: any, update = false) {
    return new Promise<any>((resolve, reject) => {
      this.verifyTableExistence(tableName).then(() => {
        if (update) {
          this.remove(tableName, data.id)
            .then(del => {
              this.create(tableName, data, true)
                .then(res => resolve(res))
                .catch(err => reject(err))
            })
            .catch(err => reject(err));
        } else {
          this.create(tableName, data)
            .then(res => resolve(res))
            .catch(err => reject(err))
        }
      });
    });
  }

  public saveAll(tableName: string = this.tableName, dataArray: any[], update = false) {
    return new Promise<any>((resolve, reject) => {
      this.verifyTableExistence(tableName).then(() => {
        dataArray.reduce((promiseChain, currentItem) => {
          return promiseChain.then((chainResults: any) =>
            this.save(tableName, currentItem, update)
              .then(currentResult => [...chainResults, currentResult]));
        }, Promise.resolve([])).then((arrayOfResults: any) => {
          resolve(arrayOfResults);
        }).catch((err: any) => {
          reject(err);
        });
      });
    });
  }

  private getLastIndex(tableName: string = this.tableName) {
    return new Promise<any>((resolve, reject) => {
      this.verifyTableExistence(tableName).then(() => {
        this.list(tableName)
          .then((list: any[]) => {
            let item = list.pop();
            let lastIndex = item ? item.id : 0;
            if (!lastIndex && lastIndex != 0) {
              reject({
                message: `No valid index; Some error occur when trying to get the last object index of the table "${tableName}";`,
                res: lastIndex
              });
            } else {
              resolve(lastIndex);
            }
          })
          .catch(err => reject(err));
      });
    });
  }

  public remove(tableName: string = this.tableName, id: number) {
    return new Promise<any>((resolve, reject) => {
      this.verifyTableExistence(tableName).then(() => {
        this.list(tableName)
          .then((list: any[]) => {
            list.splice(list.findIndex(itemToFind => itemToFind.id == id), 1);
            this.savePermanent(tableName, list)
              .then(res => resolve(res))
              .catch(err => reject(err));
          })
          .catch(err => reject(err));
      });
    });
  }

  public removeAll(tableName: string = this.tableName, areYouSure: boolean = false) {
    if (areYouSure) {
      return new Promise<any>((resolve, reject) => {
        this.verifyTableExistence(tableName).then(() => {
          this.list(tableName)
            .then((list: any[]) => {
              list = [];
              this.savePermanent(tableName, list)
                .then(res => resolve(res))
                .catch(err => reject(err));
            })
            .catch(err => reject(err));
        });
      });
    } else {
      return new Promise<any>((resolve, reject) => {
        reject('Confirm that you want to DELETE ALL DATA setting areYouSure parameter to true');
      });
    }
  }

  public saveRawObject(tableName: string = this.tableName, rawObject: any, areYouSure: boolean = false) {
    if (areYouSure) {
      return new Promise<any>((resolve, reject) => {
        this.verifyTableExistence(tableName).then(() => {
          this.removeAll(tableName, areYouSure)
            .then(() => {
              this.savePermanent(tableName, rawObject)
                .then(res => resolve(res))
                .catch(err => reject(err));
            })
            .catch(err => reject(err));
        });
      });
    } else {
      return new Promise<any>((resolve, reject) => {
        reject('Confirm that you want to DELETE ALL DATA and set RAW OBJECT setting areYouSure parameter to true');
      });
    }
  }

  private verifyTableExistence(tableName: string = this.tableName) {
    return this.createTable(tableName);
  }

  private createTable(tableName: string = this.tableName) {
    return new Promise<any>((resolve, reject) => {
      this.existTable(tableName)
        .then(res => {
          if (!res) {
            this.localStorage()
              .then((storage: Storage) => {
                storage.set(tableName, [])
                  .then(res => resolve(res))
                  .catch(err => reject(err));
              })
              .catch(err => reject(err));
          } else {
            resolve(res);
          }
        })
        .catch(err => reject(err));
    });
  }

  private existTable(tableName: string = this.tableName) {
    return new Promise<any>((resolve, reject) => {
      this.localStorage()
        .then((storage: Storage) => {
          storage.get(tableName)
            .then((res: any[]) => {
              res ? resolve(res) : resolve(res)
            })
            .catch(err => reject(err));
        })
        .catch(err => reject(err));
    });
  }

  private getRelationalData(fromTableName: string, toTableName: string, relationalId: number | null, columnName: any = null, hasOne: boolean = false, hasMany: boolean = false) {
    if (hasOne) {
      return this.getOneRelationalData(fromTableName, toTableName, relationalId, columnName);
    } else if (hasMany) {
      return this.getManyRelationalData(fromTableName, toTableName, relationalId, columnName);
    } else {
      return this.getOneRelationalData(fromTableName, toTableName, relationalId, columnName);
    }
  }

  private getOneRelationalData(fromTableName: string, toTableName: string, relationalId: number | null, columnName: any = null) {
    return new Promise<any>((resolve, reject) => {
      let column = columnName ? columnName : `id`;
      this.get(fromTableName, relationalId)
        .then((obj: any) => {
          resolve({ key: fromTableName, data: obj[column] == relationalId ? obj : null });
        })
        .catch(err => reject(err));
    });
  }

  private getManyRelationalData(fromTableName: string, toTableName: string, relationalId: number | null, columnName: any = null) {
    return new Promise<any>((resolve, reject) => {
      this.list(fromTableName)
        .then((list: any[]) => {
          let column = columnName ? columnName : `${toTableName}_id`;
          resolve({ key: fromTableName, data: list.filter(itemToFind => itemToFind[column] == relationalId) });
        })
        .catch(err => reject(err));
    });
  }

  private create(tableName: string = this.tableName, data: any, update: boolean = false) {
    return new Promise<any>((resolve, reject) => {
      this.list(tableName)
        .then((list: any[]) => {
          this.getLastIndex(tableName)
            .then((index: number) => {
              data.id = update ? data.id : index + 1; // Last available index
              list.push(data);
              this.savePermanent(tableName, list)
                .then(res => resolve(data))
                .catch(err => reject(err));
            })
            .catch((err: any) => reject(err));
        })
        .catch((err: any) => reject(err));
    });
  }

  private savePermanent(tableName: string = this.tableName, data: any) {
    return new Promise<any>((resolve, reject) => {
      this.localStorage()
        .then((storage: Storage) => {
          storage.set(tableName, data)
            .then((res: any) => resolve(res))
            .catch((err: any) => reject(err));
        })
        .catch(err => reject(err));
    });
  }

  private localStorage() {
    return new Promise<Storage>((resolve, reject) => {
      this.storage.ready()
        .then((res: any) => resolve(this.storage))
        .catch((err: any) => reject(err));
    });
  }

}
