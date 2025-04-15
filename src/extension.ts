import * as vscode from 'vscode';
import * as path from 'path';
import { log } from 'console';

interface Task {
  name: string;
  files: string[];
}

export function activate(context: vscode.ExtensionContext) {
  let tasks: Task[] = context.workspaceState.get('tasks') || []; // 初始的任务列表

  let treeDataProvider = new TaskTreeDataProvider(tasks, context.workspaceState);

  // view的创建和更新
  const taskDemoExplorer = vscode.window.createTreeView('taskView', {
    treeDataProvider: treeDataProvider
  });

  // 右键菜单，新建任务
  context.subscriptions.push(vscode.commands.registerCommand('taskDemo.newTask', () => {
    vscode.window.showInputBox({ prompt:'Your task name' }).then(newTaskName => {
      if (newTaskName) {
        tasks.push({ name: newTaskName, files: [] });
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Task ${newTaskName} created.`);
      }
    })
  }));

  // 右键菜单，删除任务
  context.subscriptions.push(vscode.commands.registerCommand('taskDemo.removeTask', (taskName: string) => {
    let taskIndex = tasks.findIndex(task => task.name === taskName);
    if (taskIndex !== -1) {
      tasks.splice(taskIndex, 1);
      treeDataProvider.refresh();
      vscode.window.showInformationMessage(`Task ${taskName} removed.`);
    }
  }));

  // 右键菜单，提交任务
  context.subscriptions.push(vscode.commands.registerCommand('taskDemo.commitTask', async (taskName: string) => {
    let task = tasks.find(task => task.name === taskName);
    if (task) {
      let commitMessage = await vscode.window.showInputBox({ prompt: 'Your commit message' });
      if (commitMessage !== undefined) {
        let terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
        for (let file of task.files) {
          terminal.sendText(`git add ${file}`);
        }
        terminal.sendText(`git commit -m "${commitMessage}"`);
      }
    }
  }));

  // 右键菜单，添加文件到任务
  context.subscriptions.push(vscode.commands.registerCommand('taskDemo.addFileToTask', (file: vscode.Uri) => {
    // 一个文件只能属于一个任务
    let fileInTask = tasks.find(task => task.files.includes(file.fsPath));
    if (fileInTask) {
      vscode.window.showErrorMessage(`File ${path.basename(file.fsPath)} already in ${fileInTask.name}.`);
      return;
    }
    vscode.window.showQuickPick(tasks.map(task => task.name)).then(selectedTaskName => {
      if (selectedTaskName) {
        let selectedTask = tasks.find(task => task.name === selectedTaskName);
        if (selectedTask) {
          selectedTask.files.push(file.fsPath);
          treeDataProvider.refresh();
          vscode.window.showInformationMessage(`File ${path.basename(file.fsPath)} added to ${selectedTaskName}.`);
        }
      }
    });
  }));

  // 右键菜单，删除文件
  context.subscriptions.push(vscode.commands.registerCommand('taskDemo.removeFile', (fileItem: string) => {
    console.log('!!!', fileItem);
    for (let task of tasks) {
      console.log('!!!', task.files);
      let fileIndex = task.files.findIndex(file  => file === fileItem)
      if (fileIndex !== -1) {
        task.files.splice(fileIndex, 1);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`File ${path.basename(fileItem)} removed from ${task.name}.`);
        break;
      }
    }
  }));
}

class TaskTreeDataProvider implements vscode.TreeDataProvider<string> {
  private _onDidChangeTreeData: vscode.EventEmitter<string | undefined> = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeTreeData: vscode.Event<string | undefined> = this._onDidChangeTreeData.event;

  constructor(private tasks: Task[], private workspaceState: vscode.Memento) {}
  
  getTreeItem(element: string): vscode.TreeItem {
    let treeItem = new vscode.TreeItem(this.isTask(element) ? element : path.basename(element));
    treeItem.collapsibleState = this.isTask(element) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
    if (this.isTask(element)) {
      treeItem.contextValue = 'task';
    } else {
      treeItem.contextValue = 'file';
      treeItem.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(element)]
      };
    }
    return treeItem;
  }

  getChildren(element?: string): Thenable<string[]> {
    if (element) {
      let task = this.tasks.find(task => task.name === element);
      return Promise.resolve(task ? task.files : []);
    } else {
      return Promise.resolve(this.tasks.map(task => task.name));
    }
  }

  refresh(): void {
    this.workspaceState.update('tasks', this.tasks);
    this._onDidChangeTreeData.fire(undefined);
  }

  private isTask(name: string): boolean {
    return this.tasks.some(task => task.name === name);
  }
}