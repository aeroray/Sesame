<script lang="ts">
interface Props {
  class?: string;
}

let { class: className = '' }: Props = $props();
</script>

<img
  src="/logo.png"
  alt=""
  aria-hidden="true"
  width="256"
  height="256"
  draggable={false}
  class="shrink-0 object-contain {className}"
/>
