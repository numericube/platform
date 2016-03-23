// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginEmail from './components/login_email.jsx';
import LoginUsername from './components/login_username.jsx';
import LoginLdap from './components/login_ldap.jsx';
import LoginMfa from './components/login_mfa.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as Client from 'utils/client.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router';

import React from 'react';

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);
        this.preSubmit = this.preSubmit.bind(this);
        this.submit = this.submit.bind(this);

        this.state = this.getStateFromStores();
    }
    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
        Client.getMeLoggedIn((data) => {
            if (data && data.logged_in !== 'false') {
                browserHistory.push('/' + this.props.params.team + '/channels/town-square');
            }
        });
    }
    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }
    getStateFromStores() {
        return {
            currentTeam: TeamStore.getByName(this.props.params.team)
        };
    }
    onTeamChange() {
        this.setState(this.getStateFromStores());
    }
    preSubmit(method, loginId, password) {
        if (global.window.mm_config.EnableMultifactorAuthentication !== 'true') {
            this.submit(method, loginId, password, '');
            return;
        }

        Client.checkMfa(method, this.state.currentTeam.name, loginId,
            (data) => {
                if (data.mfa_required === 'true') {
                    this.setState({showMfa: true, method, loginId, password});
                } else {
                    this.submit(method, loginId, password, '');
                }
            },
            (err) => {
                if (method === Constants.EMAIL_SERVICE) {
                    this.setState({serverEmailError: err.message});
                } else if (method === Constants.USERNAME_SERVICE) {
                    this.setState({serverUsernameError: err.message});
                } else if (method === Constants.LDAP_SERVICE) {
                    this.setState({serverLdapError: err.message});
                }
            }
        );
    }
    submit(method, loginId, password, token) {
        this.setState({showMfa: false, serverEmailError: null, serverUsernameError: null, serverLdapError: null});

        const team = this.state.currentTeam.name;

        if (method === Constants.EMAIL_SERVICE) {
            Client.loginByEmail(team, loginId, password, token,
                () => {
                    UserStore.setLastEmail(loginId);
                    browserHistory.push('/' + team + '/channels/town-square');
                },
                (err) => {
                    if (err.id === 'api.user.login.not_verified.app_error') {
                        browserHistory.push('/verify_email?teamname=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(loginId));
                        return;
                    }
                    this.setState({serverEmailError: err.message});
                }
            );
        } else if (method === Constants.USERNAME_SERVICE) {
            Client.loginByUsername(team, loginId, password, token,
                () => {
                    UserStore.setLastUsername(loginId);

                    const redirect = Utils.getUrlParameter('redirect');
                    if (redirect) {
                        browserHistory.push(decodeURIComponent(redirect));
                    } else {
                        browserHistory.push('/' + team + '/channels/town-square');
                    }
                },
                (err) => {
                    if (err.id === 'api.user.login.not_verified.app_error') {
                        this.setState({serverUsernameError: Utils.localizeMessage('login_username.verifyEmailError', 'Please verify your email address. Check your inbox for an email.')});
                    } else if (err.id === 'store.sql_user.get_by_username.app_error') {
                        this.setState({serverUsernameError: Utils.localizeMessage('login_username.userNotFoundError', 'We couldn\'t find an existing account matching your username for this team.')});
                    } else {
                        this.setState({serverUsernameError: err.message});
                    }
                }
            );
        } else if (method === Constants.LDAP_SERVICE) {
            Client.loginByLdap(team, loginId, password, token,
                () => {
                    const redirect = Utils.getUrlParameter('redirect');
                    if (redirect) {
                        browserHistory.push(decodeURIComponent(redirect));
                    } else {
                        browserHistory.push('/' + team + '/channels/town-square');
                    }
                },
                (err) => {
                    this.setState({serverLdapError: err.message});
                }
            );
        }
    }
    createLoginOptions(currentTeam) {
        const extraParam = Utils.getUrlParameter('extra');
        let extraBox = '';
        if (extraParam) {
            if (extraParam === Constants.SIGNIN_CHANGE) {
                extraBox = (
                    <div className='alert alert-success'>
                        <i className='fa fa-check'/>
                        <FormattedMessage
                            id='login.changed'
                            defaultMessage=' Sign-in method changed successfully'
                        />
                    </div>
                );
            } else if (extraParam === Constants.SIGNIN_VERIFIED) {
                extraBox = (
                    <div className='alert alert-success'>
                        <i className='fa fa-check'/>
                        <FormattedMessage
                            id='login.verified'
                            defaultMessage=' Email Verified'
                        />
                    </div>
                );
            } else if (extraParam === Constants.SESSION_EXPIRED) {
                extraBox = (
                    <div className='alert alert-warning'>
                        <i className='fa fa-exclamation-triangle'/>
                        <FormattedMessage
                            id='login.session_expired'
                            defaultMessage=' Your session has expired. Please login again.'
                        />
                    </div>
                );
            }
        }

        const teamName = currentTeam.name;
        const ldapEnabled = global.window.mm_config.EnableLdap === 'true';
        const gitlabSigninEnabled = global.window.mm_config.EnableSignUpWithGitLab === 'true';
        const googleSigninEnabled = global.window.mm_config.EnableSignUpWithGoogle === 'true';
        const usernameSigninEnabled = global.window.mm_config.EnableSignInWithUsername === 'true';
        const emailSigninEnabled = global.window.mm_config.EnableSignInWithEmail === 'true';

        const oauthLogins = [];
        if (gitlabSigninEnabled) {
            oauthLogins.push(
                <a
                    className='btn btn-custom-login gitlab'
                    key='gitlab'
                    href={'/api/v1/oauth/gitlab/login?team=' + encodeURIComponent(teamName)}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='login.gitlab'
                            defaultMessage='with GitLab'
                        />
                    </span>
                </a>
            );
        }

        if (googleSigninEnabled) {
            oauthLogins.push(
                <a
                    className='btn btn-custom-login google'
                    key='google'
                    href={'/api/v1/oauth/google/login?team=' + encodeURIComponent(teamName)}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='login.google'
                            defaultMessage='with Google Apps'
                        />
                    </span>
                </a>
            );
        }

        let emailLogin;
        if (emailSigninEnabled) {
            emailLogin = (
                <LoginEmail
                    teamName={teamName}
                    serverError={this.state.serverEmailError}
                    submit={this.preSubmit}
                />
            );

            if (oauthLogins.length > 0) {
                emailLogin = (
                    <div>
                        <div className='or__container'>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </div>
                        {emailLogin}
                    </div>
                );
            }
        }

        let usernameLogin;
        if (usernameSigninEnabled) {
            usernameLogin = (
                <LoginUsername
                    teamName={teamName}
                    serverError={this.state.serverUsernameError}
                    submit={this.preSubmit}
                />
            );

            if (emailSigninEnabled || oauthLogins.length > 0) {
                usernameLogin = (
                    <div>
                        <div className='or__container'>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </div>
                        {usernameLogin}
                    </div>
                );
            }
        }

        let ldapLogin;
        if (ldapEnabled) {
            ldapLogin = (
                <LoginLdap
                    teamName={teamName}
                    serverError={this.state.serverLdapError}
                    submit={this.preSubmit}
                />
            );

            if (emailSigninEnabled || usernameSigninEnabled || oauthLogins.length > 0) {
                ldapLogin = (
                    <div>
                        <div className='or__container'>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </div>
                        {ldapLogin}
                    </div>
                );
            }
        }

        let userSignUp;
        if (currentTeam.allow_open_invite) {
            userSignUp = (
                <div>
                    <span>
                        <FormattedMessage
                            id='login.noAccount'
                            defaultMessage="Don't have an account? "
                        />
                        <a
                            href={'/signup_user_complete/?id=' + currentTeam.invite_id}
                            className='signup-team-login'
                        >
                            <FormattedMessage
                                id='login.create'
                                defaultMessage='Create one now'
                            />
                        </a>
                    </span>
                </div>
            );
        }

        let forgotPassword;
        if (usernameSigninEnabled || emailSigninEnabled) {
            forgotPassword = (
                <div className='form-group'>
                    <a href={'/' + teamName + '/reset_password'}>
                        <FormattedMessage
                            id='login.forgot'
                            defaultMessage='I forgot my password'
                        />
                    </a>
                </div>
            );
        }

        let teamSignUp;
        if (global.window.mm_config.EnableTeamCreation === 'true' && !Utils.isMobileApp()) {
            teamSignUp = (
                <div className='margin--extra'>
                    <a
                        href='/'
                        className='signup-team-login'
                    >
                        <FormattedMessage
                            id='login.createTeam'
                            defaultMessage='Create a new team'
                        />
                    </a>
                </div>
            );
        }

        return (
            <div>
                {extraBox}
                {oauthLogins}
                {emailLogin}
                {usernameLogin}
                {ldapLogin}
                {userSignUp}
                {forgotPassword}
                {teamSignUp}
            </div>
        );
    }
    render() {
        const currentTeam = this.state.currentTeam;
        if (currentTeam == null) {
            return <div/>;
        }

        let content;
        if (this.state.showMfa) {
            content = (
                <LoginMfa
                    method={this.state.method}
                    loginId={this.state.loginId}
                    password={this.state.password}
                    submit={this.submit}
                />
            );
        } else {
            content = this.createLoginOptions(currentTeam);
        }

        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <h5 className='margin--less'>
                            <FormattedMessage
                                id='login.signTo'
                                defaultMessage='Sign in to:'
                            />
                        </h5>
                        <h2 className='signup-team__name'>{currentTeam.display_name}</h2>
                        <h2 className='signup-team__subdomain'>
                            <FormattedMessage
                                id='login.on'
                                defaultMessage='on {siteName}'
                                values={{
                                    siteName: global.window.mm_config.SiteName
                                }}
                            />
                        </h2>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}

Login.defaultProps = {
};
Login.propTypes = {
    params: React.PropTypes.object.isRequired
};
