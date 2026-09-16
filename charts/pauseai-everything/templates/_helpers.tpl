{{- define "pauseai-everything.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pauseai-everything.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "pauseai-everything.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "pauseai-everything.labels" -}}
helm.sh/chart: {{ include "pauseai-everything.chart" . }}
{{ include "pauseai-everything.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "pauseai-everything.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pauseai-everything.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Shared env block: plain vars from .Values.env plus envFrom the secret. */}}
{{- define "pauseai-everything.env" -}}
{{- with .Values.env }}
env:
  {{- range . }}
  - name: {{ .name }}
    value: {{ .value | quote }}
  {{- end }}
{{- end }}
{{- with .Values.existingSecret }}
envFrom:
  - secretRef:
      name: {{ . }}
{{- end }}
{{- end -}}

{{- define "pauseai-everything.image" -}}
{{ .Values.image.repository }}:{{ default .Chart.AppVersion .Values.image.tag }}
{{- end -}}
