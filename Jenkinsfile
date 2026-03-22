pipeline {
    agent any

    triggers {
        GenericTrigger(
            genericVariables: [
                [key: 'GIT_REF', value: '$.ref', defaultValue: ''],
                [key: 'REPO_URL', value: '$.repository.clone_url', defaultValue: ''],
                [key: 'AFTER_SHA', value: '$.after', defaultValue: '']
            ],
            token: 'nangman-netlab-trigger',
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
        timeout(time: 30, unit: 'MINUTES')
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

                    currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.SHORT_SHA}"
                    currentBuild.description = env.EXACT_GIT_TAG
                        ? "main -> ${env.EXACT_GIT_TAG}"
                        : "main -> sha-${env.SHORT_SHA}"

                    echo "Repository: ${env.REPO_URL ?: 'configured SCM'}"
                    echo "Branch ref: ${env.BUILD_REF}"
                    echo "Image repository: ${env.IMAGE_REPO}"
                    echo "Image tags: latest, sha-${env.SHORT_SHA}${env.EXACT_GIT_TAG ? ", ${env.EXACT_GIT_TAG}" : ''}"
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

        stage('Docker Build & Push') {
            steps {
                script {
                    def tagArgs = [
                        "--tag ${env.IMAGE_LATEST}",
                        "--tag ${env.IMAGE_REPO}:sha-${env.SHORT_SHA}"
                    ]

                    if (env.EXACT_GIT_TAG) {
                        tagArgs << "--tag ${env.IMAGE_REPO}:${env.EXACT_GIT_TAG}"
                    }

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
                                --platform ${env.PLATFORMS} \\
                                --build-arg APP_BUILD_SHA=${env.SHORT_SHA} \\
                                --build-arg APP_BUILD_REF=${env.BUILD_REF} \\
                                --build-arg APP_BUILD_TIME=${env.BUILD_TIMESTAMP} \\
                                ${tagArgs.join(' \\\n                                ')} \\
                                --cache-from type=registry,ref=${env.IMAGE_CACHE} \\
                                --cache-to type=registry,ref=${env.IMAGE_CACHE},mode=max \\
                                --push \\
                                --progress=plain \\
                                .

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

                        if [ -n "$EXACT_GIT_TAG" ]; then
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

                            if echo "$body" | grep -q "\"buildSha\":\"$SHORT_SHA\""; then
                                echo "Deployment verified at $APP_HEALTH_URL"
                                exit 0
                            fi
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
