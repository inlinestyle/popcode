import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom';
import {DraggableCore} from 'react-draggable';
import {connect} from 'react-redux';
import values from 'lodash/values';
import bindAll from 'lodash/bindAll';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import isNull from 'lodash/isNull';
import partial from 'lodash/partial';
import sortBy from 'lodash/sortBy';
import map from 'lodash/map';
import isError from 'lodash/isError';
import isString from 'lodash/isString';
import {t} from 'i18next';
import qs from 'qs';
import base64 from 'base64-js';
import {TextEncoder} from 'text-encoding';
import Bugsnag from '../util/Bugsnag';
import Gists, {EmptyGistError} from '../services/Gists';
import {
  onSignedIn,
  onSignedOut,
  signIn,
  signOut,
  startSessionHeartbeat,
} from '../clients/firebaseAuth';
import {openWindowWithWorkaroundForChromeClosingBug} from '../util';

import {
  addRuntimeError,
  changeCurrentProject,
  clearRuntimeErrors,
  createProject,
  updateProjectSource,
  userAuthenticated,
  userLoggedOut,
  toggleLibrary,
  minimizeComponent,
  maximizeComponent,
  toggleDashboard,
  toggleDashboardSubmenu,
  userRequestedFocusedLine,
  editorFocusedRequestedLine,
  notificationTriggered,
  userDismissedNotification,
  exportingGist,
  applicationLoaded,
} from '../actions';

import {getCurrentProject, isPristineProject} from '../util/projectUtils';

import EditorContainer from './EditorContainer';
import Editor from './Editor';
import Output from './Output';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import NotificationList from './NotificationList';
import PopThrobber from './PopThrobber';

const spinnerPage = base64.fromByteArray(
  new TextEncoder('utf-8').encode(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../templates/github-export.html',
      ),
    ),
  ),
);

const DIVIDER_HEIGHT = 4;
const defaultEditorFlex = ['1', '1', '1'];

function mapStateToProps(state) {
  const projects = sortBy(
    values(state.get('projects').toJS()),
    project => -project.updatedAt,
  );

  return {
    allProjects: projects,
    currentProject: getCurrentProject(state),
    errors: state.get('errors').toJS(),
    runtimeErrors: state.get('runtimeErrors').toJS(),
    isUserTyping: state.getIn(['ui', 'editors', 'typing']),
    currentUser: state.get('user').toJS(),
    ui: state.get('ui').toJS(),
    clients: state.get('clients').toJS(),
  };
}

class Workspace extends React.Component {
  constructor() {
    super();
    this.editorRefs = [];
    this.state = {editorFlex: defaultEditorFlex};
    bindAll(
      this,
      '_confirmUnload',
      '_handleClearRuntimeErrors',
      '_handleComponentMaximized',
      '_handleComponentMinimized',
      '_handleDashboardSubmenuToggled',
      '_handleEditorDividerDrag',
      '_handleEditorInput',
      '_handleErrorClick',
      '_handleLibraryToggled',
      '_handleLogOut',
      '_handleNewProject',
      '_handleProjectSelected',
      '_handleRuntimeError',
      '_handleStartLogIn',
      '_handleToggleDashboard',
      '_handleRequestedLineFocused',
      '_handleNotificationDismissed',
      '_handleExportGist',
      '_storeEditorRef',
    );
  }

  componentWillMount() {
    let gistId;
    if (location.search) {
      const query = qs.parse(location.search.slice(1));
      gistId = query.gist;
    }
    history.replaceState({}, '', location.pathname);
    this.props.dispatch(applicationLoaded(gistId));
    this._listenForAuthChange();
    startSessionHeartbeat();
  }

  componentDidMount() {
    addEventListener('beforeunload', this._confirmUnload);
  }

  componentWillUnmount() {
    removeEventListener('beforeunload', this._confirmUnload);
  }

  _confirmUnload(event) {
    if (!this.props.currentUser.authenticated) {
      const currentProject = this.props.currentProject;
      if (!isNull(currentProject) && !isPristineProject(currentProject)) {
        event.returnValue = t('workspace.confirmations.unload-unsaved');
      }
    }
  }

  _allErrorsFor(language) {
    if (language === 'javascript') {
      return this.props.errors.javascript.items.
        concat(this.props.runtimeErrors);
    }

    return this.props.errors[language].items;
  }

  _handleComponentMinimized(componentName) {
    this.setState({editorFlex: defaultEditorFlex});
    this.props.dispatch(minimizeComponent(componentName));
  }

  _handleComponentMaximized(componentName) {
    this.setState({editorFlex: defaultEditorFlex});
    this.props.dispatch(maximizeComponent(componentName));
  }

  _handleErrorClick(language, line, column) {
    this.props.dispatch(maximizeComponent(`editor.${language}`));
    this.props.dispatch(userRequestedFocusedLine(language, line, column));
  }

  _handleEditorInput(language, source) {
    this.props.dispatch(
      updateProjectSource(
        this.props.currentProject.projectKey,
        language,
        source,
      ),
    );
  }

  _handleLibraryToggled(libraryKey) {
    this.props.dispatch(
      toggleLibrary(
        this.props.currentProject.projectKey,
        libraryKey,
      ),
    );
  }

  _handleNewProject() {
    this.props.dispatch(createProject());
  }

  _handleProjectSelected(project) {
    this.props.dispatch(changeCurrentProject(project.projectKey));
  }

  _handleDashboardSubmenuToggled(submenu) {
    this.props.dispatch(toggleDashboardSubmenu(submenu));
  }

  _handleRuntimeError(error) {
    this.props.dispatch(addRuntimeError(error));
  }

  _handleClearRuntimeErrors() {
    this.props.dispatch(clearRuntimeErrors());
  }

  _getOverallValidationState() {
    const errorStates = map(values(this.props.errors), 'state');

    if (includes(errorStates, 'failed')) {
      if (this.props.isUserTyping) {
        return 'validating';
      }
      return 'failed';
    }

    if (includes(errorStates, 'validating')) {
      return 'validating';
    }

    return 'passed';
  }

  _renderOutput() {
    return (
      <Output
        errors={this.props.errors}
        isHidden={includes(this.props.ui.minimizedComponents, 'output')}
        project={this.props.currentProject}
        runtimeErrors={this.props.runtimeErrors}
        validationState={this._getOverallValidationState()}
        onClearRuntimeErrors={this._handleClearRuntimeErrors}
        onErrorClick={this._handleErrorClick}
        onMinimize={
          partial(this._handleComponentMinimized,
            'output')
        }
        onRuntimeError={this._handleRuntimeError}
      />
    );
  }

  _storeEditorRef(index, editor) {
    this.editorRefs[index] = editor;
  }

  _handleEditorDividerDrag(index, _, {y}) {
    const nodes = this.editorRefs.filter(Boolean).map(ReactDOM.findDOMNode);
    let editorFlex;
    if (index === 0) {
      editorFlex = [
        `0 1 ${y + DIVIDER_HEIGHT}px`,
        '1',
        (nodes.length === 3) ? `0 1 ${nodes[2].offsetHeight}px` : '1',
      ];
    } else {
      editorFlex = [
        `0 1 ${nodes[0].offsetHeight + DIVIDER_HEIGHT}px`,
        `0 1 ${y + DIVIDER_HEIGHT}px`,
        '1',
      ];
    }
    this.setState({editorFlex});
  }

  _renderEditors() {
    this.editorRefs = [];
    const {editorFlex} = this.state;
    const editors = [];
    const languages = ['html', 'css', 'javascript'].filter(language =>
      !includes(this.props.ui.minimizedComponents, `editor.${language}`),
    );

    languages.forEach((language, index) => {
      editors.push(
        <EditorContainer
          key={language}
          language={language}
          source={this.props.currentProject.sources[language]}
          style={{flex: editorFlex[index]}}
          onMinimize={
            partial(this._handleComponentMinimized, `editor.${language}`)
          }
        >
          <Editor
            errors={this._allErrorsFor(language)}
            key={language}
            language={language}
            percentageOfHeight={1 / languages.length}
            projectKey={this.props.currentProject.projectKey}
            ref={partial(this._storeEditorRef, index)}
            requestedFocusedLine={this.props.ui.editors.requestedFocusedLine}
            source={this.props.currentProject.sources[language]}
            onInput={partial(this._handleEditorInput, language)}
            onRequestedLineFocused={this._handleRequestedLineFocused}
          />
          {(index < languages.length - 1) &&
            <DraggableCore
              axis="y"
              bounds="parent"
              key={`divider:${language}`}
              onDrag={partial(this._handleEditorDividerDrag, index)}
            >
              <div className="editors__divider" />
            </DraggableCore>
          }
        </EditorContainer>,
      );
    });

    if (isEmpty(editors)) {
      return null;
    }

    return (
      <div className="environment__column">
        <div className="environment__columnContents editors">{editors}</div>
      </div>
    );
  }

  _handleToggleDashboard() {
    this.props.dispatch(toggleDashboard());
  }

  _listenForAuthChange() {
    onSignedIn(userCredential =>
      this.props.dispatch(userAuthenticated(userCredential)),
    );
    onSignedOut(() => this.props.dispatch(userLoggedOut()));
  }

  _handleStartLogIn() {
    signIn().catch((e) => {
      switch (e.code) {
        case 'auth/popup-closed-by-user':
          this.props.dispatch(notificationTriggered('user-cancelled-auth'));
          break;
        case 'auth/network-request-failed':
          this.props.dispatch(notificationTriggered('auth-network-error'));
          break;
        case 'auth/cancelled-popup-request':
          break;
        case 'auth/web-storage-unsupported':
          this.props.dispatch(
            notificationTriggered('auth-third-party-cookies-disabled'),
          );
          break;
        default:
          this.props.dispatch(notificationTriggered('auth-error'));
          if (isError(e)) {
            Bugsnag.notifyException(e, e.code);
          } else if (isString(e)) {
            Bugsnag.notifyException(new Error(e));
          }
          break;
      }
    });
  }

  _handleNotificationDismissed(error) {
    this.props.dispatch(userDismissedNotification(error.type));
  }

  _handleLogOut() {
    signOut();
  }

  _handleRequestedLineFocused() {
    this.props.dispatch(editorFocusedRequestedLine());
  }

  async _handleExportGist() {
    if (this.props.clients.gists.exportInProgress) {
      return;
    }

    if (!this.props.currentUser.authenticated) {
      // eslint-disable-next-line no-alert
      if (!confirm(t('workspace.confirmations.anonymous-gist-export'))) {
        return;
      }
    }

    const newWindow = openWindowWithWorkaroundForChromeClosingBug(
      `data:text/html;base64,${spinnerPage}`,
    );

    const gistWillExport = Gists.createFromProject(
      this.props.currentProject,
      this.props.currentUser,
    );
    this.props.dispatch(exportingGist(gistWillExport));

    try {
      const response = await gistWillExport;
      if (newWindow.closed) {
        this.props.dispatch(
          notificationTriggered(
            'gist-export-complete',
            'notice',
            {url: response.html_url},
          ),
        );
      } else {
        newWindow.location.href = response.html_url;
      }
    } catch (error) {
      if (error instanceof EmptyGistError) {
        this.props.dispatch(notificationTriggered('empty-gist'));
        if (!newWindow.closed) {
          newWindow.close();
        }
        return;
      }
      this.props.dispatch(notificationTriggered('gist-export-error'));
      if (!newWindow.closed) {
        newWindow.close();
      }
      throw error;
    }
  }

  _renderDashboard() {
    if (!this.props.ui.dashboard.isOpen) {
      return null;
    }

    return (
      <div className="layout__dashboard">
        <Dashboard
          activeSubmenu={this.props.ui.dashboard.activeSubmenu}
          allProjects={this.props.allProjects}
          currentProject={this.props.currentProject}
          currentUser={this.props.currentUser}
          gistExportInProgress={this.props.clients.gists.exportInProgress}
          validationState={this._getOverallValidationState()}
          onExportGist={this._handleExportGist}
          onLibraryToggled={this._handleLibraryToggled}
          onLogOut={this._handleLogOut}
          onNewProject={this._handleNewProject}
          onProjectSelected={this._handleProjectSelected}
          onStartLogIn={this._handleStartLogIn}
          onSubmenuToggled={this._handleDashboardSubmenuToggled}
        />
      </div>
    );
  }

  _renderSidebar() {
    return (
      <div className="layout__sidebar">
        <Sidebar
          dashboardIsOpen={this.props.ui.dashboard.isOpen}
          minimizedComponents={this.props.ui.minimizedComponents}
          validationState={this._getOverallValidationState()}
          onComponentMaximized={this._handleComponentMaximized}
          onToggleDashboard={this._handleToggleDashboard}
        />
      </div>
    );
  }

  _renderEnvironment() {
    if (isNull(this.props.currentProject)) {
      return <PopThrobber message={t('workspace.loading')} />;
    }

    return (
      <div className="environment">
        {this._renderEditors()}
        {this._renderOutput()}
      </div>
    );
  }

  render() {
    return (
      <div>
        <NotificationList
          notifications={this.props.ui.notifications}
          onErrorDismissed={this._handleNotificationDismissed}
        />
        <div className="layout">
          {this._renderDashboard()}
          {this._renderSidebar()}
          <div className="workspace layout__main">
            {this._renderEnvironment()}
          </div>
        </div>
      </div>
    );
  }
}

Workspace.propTypes = {
  allProjects: React.PropTypes.array.isRequired,
  clients: React.PropTypes.object.isRequired,
  currentProject: React.PropTypes.object,
  currentUser: React.PropTypes.object.isRequired,
  dispatch: React.PropTypes.func.isRequired,
  errors: React.PropTypes.object.isRequired,
  isUserTyping: React.PropTypes.bool,
  runtimeErrors: React.PropTypes.array.isRequired,
  ui: React.PropTypes.object.isRequired,
};

Workspace.defaultProps = {
  currentProject: null,
  isUserTyping: false,
};

export default connect(mapStateToProps)(Workspace);
