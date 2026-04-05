pipeline {
    agent any

    triggers {
        GenericTrigger(
            genericVariables: [
                [key: 'GIT_REF', value: '$.ref', defaultValue: ''],
                [key: 'REPO_URL', value: '$.repository.clone_url', defaultValue: ''],
                [key: 'BEFORE_SHA', value: '$.before', defaultValue: ''],
                [key: 'AFTER_SHA', value: '$.after', defaultValue: '']
            ],
            tokenCredentialId: 'nangman-netlab-trigger',
            causeString: 'Netlab main push detected',
            regexpFilterText: '$REPO_URL $GIT_REF',
            regexpFilterExpression: '.*pandora0667/netlab.* refs/heads/main',
            printContributedVariables: true,
            printPostContent: true
        )
    }

    environment {
        HARBOR_URL = 'harbor.nangman.cloud'
        HARBOR_PROJECT = 'library'
        HARBOR_CREDS_ID = 'harbor-auth'

        IMAGE_NAME = 'netlab'
        IMAGE_REPO = "${HARBOR_URL}/${HARBOR_PROJECT}/${IMAGE_NAME}"
        IMAGE_CACHE = "${IMAGE_REPO}:buildcache"
        IMAGE_LATEST = "${IMAGE_REPO}:latest"
        RUNTIME_BASE_IMAGE_REPO = "${HARBOR_URL}/${HARBOR_PROJECT}/netlab-runtime-base"
        RUNTIME_BASE_CACHE = "${RUNTIME_BASE_IMAGE_REPO}:buildcache"

        WATCHTOWER_URL = 'http://192.168.11.134:18081'
        WATCHTOWER_TOKEN = credentials('nangman-netlab-watchtower-token')
        APP_HEALTH_URL = 'http://192.168.11.134:8080/healthz'
        DEPLOY_TIMEOUT_SECONDS = '180'

        DOCKER_BUILDKIT = '1'
        DOCKER_CLI_EXPERIMENTAL = 'enabled'
        PLATFORMS = 'linux/amd64,linux/arm64'
    }

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 60, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Initialize') {
            steps {
                script {
                    env.SHORT_SHA = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
                    env.EXACT_GIT_TAG = sh(
                        script: 'git fetch --tags --force >/dev/null 2>&1 || true; git tag --points-at HEAD | head -n 1',
                        returnStdout: true
                    ).trim()
                    env.BUILD_TIMESTAMP = sh(
                        script: 'date -u +%Y-%m-%dT%H:%M:%SZ',
                        returnStdout: true
                    ).trim()
                    env.BUILD_REF = env.GIT_REF ?: 'refs/heads/main'

                    def hasBeforeSha = env.BEFORE_SHA?.trim() && sh(
                        script: "git cat-file -e ${env.BEFORE_SHA}^{commit} >/dev/null 2>&1",
                        returnStatus: true
                    ) == 0
                    def hasAfterSha = env.AFTER_SHA?.trim() && sh(
                        script: "git cat-file -e ${env.AFTER_SHA}^{commit} >/dev/null 2>&1",
                        returnStatus: true
                    ) == 0
                    def diffLabel
                    def changedFilesText

                    if (hasBeforeSha && hasAfterSha) {
                        diffLabel = "${env.BEFORE_SHA.take(12)}..${env.AFTER_SHA.take(12)}"
                        changedFilesText = sh(
                            script: "git diff --name-only ${env.BEFORE_SHA} ${env.AFTER_SHA}",
                            returnStdout: true
                        ).trim()
                    } else if (sh(script: 'git rev-parse HEAD^ >/dev/null 2>&1', returnStatus: true) == 0) {
                        diffLabel = 'HEAD^..HEAD'
                        changedFilesText = sh(
                            script: 'git diff --name-only HEAD^ HEAD',
                            returnStdout: true
                        ).trim()
                    } else {
                        diffLabel = 'full-tree'
                        changedFilesText = sh(
                            script: 'git ls-tree --name-only -r HEAD',
                            returnStdout: true
                        ).trim()
                    }

                    def changedFiles = changedFilesText ? changedFilesText.readLines() : []
                    env.RUNTIME_BASE_CHANGED = changedFiles.contains('Dockerfile.runtime-base') ? 'true' : 'false'
                    env.RUNTIME_BASE_LATEST = "${env.RUNTIME_BASE_IMAGE_REPO}:latest"
                    env.RUNTIME_BASE_SHA = "${env.RUNTIME_BASE_IMAGE_REPO}:sha-${env.SHORT_SHA}"
                    env.RUNTIME_BASE_IMAGE = env.EXACT_GIT_TAG
                        ? "${env.RUNTIME_BASE_IMAGE_REPO}:${env.EXACT_GIT_TAG}"
                        : env.RUNTIME_BASE_LATEST
                    env.RUNTIME_BASE_REASON = env.RUNTIME_BASE_CHANGED == 'true'
                        ? "Dockerfile.runtime-base changed in ${diffLabel}"
                        : "reusing published runtime base from ${diffLabel}"

                    currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.SHORT_SHA}"
                    currentBuild.description = env.EXACT_GIT_TAG
                        ? "main -> ${env.EXACT_GIT_TAG}"
                        : "main -> sha-${env.SHORT_SHA}"

                    echo "Repository: ${env.REPO_URL ?: 'configured SCM'}"
                    echo "Branch ref: ${env.BUILD_REF}"
                    echo "Image repository: ${env.IMAGE_REPO}"
                    echo "Image tags: latest, sha-${env.SHORT_SHA}${env.EXACT_GIT_TAG ? ", ${env.EXACT_GIT_TAG}" : ''}"
                    echo "Runtime base strategy: ${env.RUNTIME_BASE_REASON}"
                    echo "Runtime base image: ${env.RUNTIME_BASE_IMAGE}"
                }
            }
        }

        stage('Setup Buildx') {
            steps {
                sh '''
                    docker buildx version
                    docker buildx inspect multiarch-builder --bootstrap >/dev/null 2>&1 || \
                    docker buildx create --name multiarch-builder --use --platform linux/amd64,linux/arm64
                    docker buildx use multiarch-builder
                    docker buildx inspect multiarch-builder --bootstrap
                '''
            }
        }

        stage('Publish Runtime Base') {
            options {
                timeout(time: 45, unit: 'MINUTES')
            }
            steps {
                script {
                    withCredentials([
                        usernamePassword(
                            credentialsId: env.HARBOR_CREDS_ID,
                            usernameVariable: 'HARBOR_USERNAME',
                            passwordVariable: 'HARBOR_PASSWORD'
                        )
                    ]) {
                        sh """
                            set -eu
                            echo "\$HARBOR_PASSWORD" | docker login ${env.HARBOR_URL} -u "\$HARBOR_USERNAME" --password-stdin
                        """

                        try {
                            if (env.RUNTIME_BASE_CHANGED == 'true') {
                                def runtimeBaseCacheFromArg = sh(
                                    script: "docker buildx imagetools inspect ${env.RUNTIME_BASE_CACHE} >/dev/null 2>&1",
                                    returnStatus: true
                                ) == 0
                                    ? "--cache-from type=registry,ref=${env.RUNTIME_BASE_CACHE}"
                                    : ""
                                def baseTagArgs = [
                                    "--tag ${env.RUNTIME_BASE_LATEST}",
                                    "--tag ${env.RUNTIME_BASE_SHA}"
                                ]

                                if (env.EXACT_GIT_TAG) {
                                    baseTagArgs << "--tag ${env.RUNTIME_BASE_IMAGE_REPO}:${env.EXACT_GIT_TAG}"
                                }

                                def runtimeBaseBuildArgs = [
                                    "--platform ${env.PLATFORMS}",
                                    "--file Dockerfile.runtime-base"
                                ] + baseTagArgs

                                if (runtimeBaseCacheFromArg) {
                                    runtimeBaseBuildArgs << runtimeBaseCacheFromArg
                                }

                                runtimeBaseBuildArgs += [
                                    "--cache-to type=registry,ref=${env.RUNTIME_BASE_CACHE},mode=max",
                                    "--push",
                                    "--progress=plain",
                                    "."
                                ]

                                sh """
                                    docker buildx build \\
                                        ${runtimeBaseBuildArgs.join(' \\\n                                        ')}
                                """
                            } else if (env.EXACT_GIT_TAG) {
                                def runtimeTagExists = sh(
                                    script: "docker buildx imagetools inspect ${env.RUNTIME_BASE_IMAGE_REPO}:${env.EXACT_GIT_TAG} >/dev/null 2>&1",
                                    returnStatus: true
                                ) == 0

                                if (runtimeTagExists) {
                                    echo "Runtime base git tag ${env.EXACT_GIT_TAG} already exists; reusing published manifest."
                                } else {
                                    sh """
                                        docker buildx imagetools create \\
                                            --tag ${env.RUNTIME_BASE_IMAGE_REPO}:${env.EXACT_GIT_TAG} \\
                                            ${env.RUNTIME_BASE_LATEST}
                                    """
                                }
                            } else {
                                echo "Runtime base unchanged and no git tag present; reusing ${env.RUNTIME_BASE_LATEST}"
                            }
                        } finally {
                            sh 'docker logout $HARBOR_URL'
                        }
                    }
                }
            }
        }

        stage('Verify Runtime Base') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: env.HARBOR_CREDS_ID,
                        usernameVariable: 'HARBOR_USERNAME',
                        passwordVariable: 'HARBOR_PASSWORD'
                    )
                ]) {
                    sh '''
                        set -eu
                        echo "$HARBOR_PASSWORD" | docker login $HARBOR_URL -u "$HARBOR_USERNAME" --password-stdin

                        echo "Inspecting runtime base latest manifest"
                        docker buildx imagetools inspect $RUNTIME_BASE_LATEST

                        if [ "$RUNTIME_BASE_CHANGED" = "true" ]; then
                            echo "Inspecting runtime base sha manifest"
                            docker buildx imagetools inspect $RUNTIME_BASE_SHA
                        fi

                        if [ -n "${EXACT_GIT_TAG:-}" ]; then
                            echo "Inspecting runtime base git tag manifest"
                            docker buildx imagetools inspect $RUNTIME_BASE_IMAGE
                        fi

                        docker logout $HARBOR_URL
                    '''
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                script {
                    def appCacheFromArg = sh(
                        script: "docker buildx imagetools inspect ${env.IMAGE_CACHE} >/dev/null 2>&1",
                        returnStatus: true
                    ) == 0
                        ? "--cache-from type=registry,ref=${env.IMAGE_CACHE}"
                        : ""
                    def tagArgs = [
                        "--tag ${env.IMAGE_LATEST}",
                        "--tag ${env.IMAGE_REPO}:sha-${env.SHORT_SHA}"
                    ]

                    if (env.EXACT_GIT_TAG) {
                        tagArgs << "--tag ${env.IMAGE_REPO}:${env.EXACT_GIT_TAG}"
                    }

                    def appBuildArgs = [
                        "--platform ${env.PLATFORMS}",
                        "--build-arg APP_BUILD_SHA=${env.SHORT_SHA}",
                        "--build-arg APP_BUILD_REF=${env.BUILD_REF}",
                        "--build-arg APP_BUILD_TIME=${env.BUILD_TIMESTAMP}",
                        "--build-arg RUNTIME_BASE_IMAGE=${env.RUNTIME_BASE_IMAGE}"
                    ] + tagArgs

                    if (appCacheFromArg) {
                        appBuildArgs << appCacheFromArg
                    }

                    appBuildArgs += [
                        "--cache-to type=registry,ref=${env.IMAGE_CACHE},mode=max",
                        "--push",
                        "--progress=plain",
                        "."
                    ]

                    withCredentials([
                        usernamePassword(
                            credentialsId: env.HARBOR_CREDS_ID,
                            usernameVariable: 'HARBOR_USERNAME',
                            passwordVariable: 'HARBOR_PASSWORD'
                        )
                    ]) {
                        sh """
                            echo "\$HARBOR_PASSWORD" | docker login ${env.HARBOR_URL} -u "\$HARBOR_USERNAME" --password-stdin

                            docker buildx build \\
                                ${appBuildArgs.join(' \\\n                                ')}

                            docker logout ${env.HARBOR_URL}
                        """
                    }
                }
            }
        }

        stage('Verify Images') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: env.HARBOR_CREDS_ID,
                        usernameVariable: 'HARBOR_USERNAME',
                        passwordVariable: 'HARBOR_PASSWORD'
                    )
                ]) {
                    sh '''
                        echo "$HARBOR_PASSWORD" | docker login $HARBOR_URL -u "$HARBOR_USERNAME" --password-stdin

                        echo "Inspecting latest manifest"
                        docker buildx imagetools inspect $IMAGE_LATEST

                        echo "Inspecting sha manifest"
                        docker buildx imagetools inspect $IMAGE_REPO:sha-$SHORT_SHA

                        if [ -n "${EXACT_GIT_TAG:-}" ]; then
                            echo "Inspecting git tag manifest"
                            docker buildx imagetools inspect $IMAGE_REPO:$EXACT_GIT_TAG
                        fi

                        docker logout $HARBOR_URL
                    '''
                }
            }
        }

        stage('Trigger Watchtower') {
            steps {
                sh '''
                    response=$(curl -sS -w "\\n%{http_code}" \
                        -H "Authorization: Bearer $WATCHTOWER_TOKEN" \
                        "$WATCHTOWER_URL/v1/update")

                    http_code=$(echo "$response" | tail -n1)
                    body=$(echo "$response" | sed '$d')

                    if [ "$http_code" -eq 200 ]; then
                        echo "Watchtower update triggered successfully"
                        echo "Response: $body"
                    else
                        echo "Failed to trigger Watchtower update"
                        echo "HTTP Code: $http_code"
                        echo "Response: $body"
                        exit 1
                    fi
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    deadline=$(( $(date +%s) + $DEPLOY_TIMEOUT_SECONDS ))

                    while [ "$(date +%s)" -lt "$deadline" ]; do
                        body=$(curl -fsS "$APP_HEALTH_URL" || true)

                        if [ -n "$body" ]; then
                            echo "Health response: $body"

                            case "$body" in
                              *buildSha*"$SHORT_SHA"*)
                                echo "Deployment verified at $APP_HEALTH_URL"
                                exit 0
                                ;;
                            esac
                        fi

                        sleep 5
                    done

                    echo "Deployment verification timed out after ${DEPLOY_TIMEOUT_SECONDS}s"
                    exit 1
                '''
            }
        }
    }

    post {
        success {
            mattermostSend(
                color: 'good',
                message: ":tada: 빌드 성공! 배포가 완료되었습니다.\n프로젝트: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n바로가기: ${env.BUILD_URL}"
            )
        }

        failure {
            mattermostSend(
                color: 'danger',
                message: ":rotating_light: 빌드 실패... 로그를 확인해주세요.\n프로젝트: ${env.JOB_NAME} #${env.BUILD_NUMBER}\n바로가기: ${env.BUILD_URL}"
            )
        }

        always {
            script {
                echo "빌드 완료. Buildx는 이미지를 직접 푸시하므로 로컬 정리가 불필요합니다."
            }
        }
    }
}
