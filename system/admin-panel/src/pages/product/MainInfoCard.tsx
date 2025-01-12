import { resolvePageRoute, serviceLocator, TProductVariant, TProduct, TStockStatus, getRandStr } from '@cromwell/core';
import { Autocomplete, Grid, TextField, Tooltip } from '@mui/material';
import React, { useEffect } from 'react';

import { GalleryPicker } from '../../components/galleryPicker/GalleryPicker';
import { Select } from '../../components/select/Select';
import { getEditorData, getEditorHtml, initTextEditor } from '../../helpers/editor/editor';
import { useForceUpdate } from '../../helpers/forceUpdate';
import { NumberFormatCustom } from '../../helpers/NumberFormatCustom';
import styles from './Product.module.scss';
import { debounce } from 'throttle-debounce';


const MainInfoCard = (props: {
    product: TProduct | TProductVariant,
    setProdData: (data: TProduct | TProductVariant) => void;
    isProductVariant?: boolean;
    canValidate?: boolean;
}) => {
    const productPrevRef = React.useRef<TProductVariant | TProduct | null>(props.product);
    const cardIdRef = React.useRef<string>(getRandStr(10));
    const productRef = React.useRef<TProductVariant | TProduct | null>(props.product);
    if (props.product !== productPrevRef.current) {
        productPrevRef.current = props.product;
        productRef.current = props.product;
    }
    const forceUpdate = useForceUpdate();
    const editorId = "prod-text-editor_" + cardIdRef.current;
    const product = productRef.current;

    const setProdData = (data: TProduct) => {
        Object.keys(data).forEach(key => { productRef.current[key] = data[key] })
        props.setProdData(data);
        forceUpdate();
    }

    const fullSave = async () => {
        setProdData({
            ...(product as TProduct),
            description: await getEditorHtml(editorId),
            descriptionDelta: JSON.stringify(await getEditorData(editorId)),
        });
    }

    useEffect(() => {
        init();
    }, [])

    const init = async () => {
        let descriptionDelta;
        if (product?.descriptionDelta) {
            try {
                descriptionDelta = JSON.parse(product.descriptionDelta);
            } catch (e) { console.error(e) }
        }

        const updateText = debounce(600, () => {
            fullSave();
        })

        await initTextEditor({
            htmlId: editorId,
            data: descriptionDelta,
            placeholder: 'Product description...',
            onChange: updateText,
        });
    }

    const handleChange = (prop: keyof TProduct, val: any) => {
        if (product) {
            const prod = Object.assign({}, product);
            (prod[prop] as any) = val;

            if (prop === 'images') {
                prod.mainImage = val?.[0];
            }
            setProdData(prod as TProduct);
        }
    }

    if (!product) return null;

    let pageFullUrl;
    if ((product as TProduct)?.slug) {
        pageFullUrl = serviceLocator.getFrontendUrl() + resolvePageRoute('product', {
            slug: (product as TProduct).slug ?? (product as TProduct).id + '',
        });
    }

    return (
        <Grid container spacing={3}>
            <Grid item xs={12} sm={12}>
                <TextField label="Name" variant="standard"
                    value={product.name ?? ''}
                    className={styles.textField}
                    onChange={(e) => { handleChange('name', e.target.value) }}
                    error={props.canValidate && !product?.name}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField label="SKU" variant="standard"
                    value={product.sku ?? ''}
                    className={styles.textField}
                    onChange={(e) => { handleChange('sku', e.target.value) }}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Select
                    fullWidth
                    label="Stock status"
                    variant="standard"
                    value={product.stockStatus}
                    onChange={(e) => { handleChange('stockStatus', e.target.value) }}
                    options={['In stock', 'Out of stock', 'On backorder'] as TStockStatus[]}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField label="Price" variant="standard"
                    value={product.price ?? ''}
                    className={styles.textField}
                    onChange={(e) => { handleChange('price', e.target.value) }}
                    InputProps={{
                        inputComponent: NumberFormatCustom as any,
                    }}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField label="Old price" variant="standard"
                    value={product.oldPrice ?? ''}
                    className={styles.textField}
                    onChange={(e) => {
                        const val = e.target.value;
                        handleChange('oldPrice', (val && val !== '') ? val : null);
                    }}
                    InputProps={{
                        inputComponent: NumberFormatCustom as any,
                    }}
                />
            </Grid>
            <Grid item xs={12} sm={12}>
                <div className={styles.imageBlock}>
                    <GalleryPicker
                        classes={{
                            imagePicker: {
                                root: styles.imageItem
                            }
                        }}
                        label="Gallery"
                        images={((product as TProduct)?.images ?? []).map(src => ({ src }))}
                        onChange={(val) => handleChange('images', val.map(s => s.src))}
                    />
                </div>
            </Grid>
            <Grid item xs={12} sm={12}>
                <div className={styles.descriptionEditor}>
                    <div style={{ minHeight: '300px' }} id={editorId}></div>
                </div>
            </Grid>
            <Grid item xs={12} sm={12}>
                {props.isProductVariant !== true && (
                    <TextField label="Page URL" variant="standard"
                        value={(product as TProduct).slug ?? ''}
                        className={styles.textField}
                        onChange={(e) => { handleChange('slug', e.target.value) }}
                        helperText={pageFullUrl}
                    />
                )}
            </Grid>
            <Grid item xs={12} sm={12}>
                {props.isProductVariant !== true && (
                    <TextField label="Meta title" variant="standard"
                        value={(product as TProduct).pageTitle ?? ''}
                        className={styles.textField}
                        onChange={(e) => { handleChange('pageTitle', e.target.value) }}
                    />
                )}
            </Grid>
            <Grid item xs={12} sm={12}>
                {props.isProductVariant !== true && (
                    <TextField label="Meta description" variant="standard"
                        multiline
                        value={(product as TProduct).pageDescription ?? ''}
                        className={styles.textField}
                        onChange={(e) => { handleChange('pageDescription', e.target.value) }}
                    />
                )}
            </Grid>
            <Grid item xs={12} sm={12}>
                {props.isProductVariant !== true && (
                    <Autocomplete
                        multiple
                        freeSolo
                        options={[]}
                        className={styles.textField}
                        value={((product as TProduct).meta?.keywords ?? []) as any}
                        getOptionLabel={(option) => option}
                        onChange={(e, newVal) => {
                            handleChange('meta', {
                                ...((product as TProduct).meta ?? {}),
                                keywords: newVal
                            })
                        }}
                        renderInput={(params) => (
                            <Tooltip title="Press ENTER to add">
                                <TextField
                                    {...params}
                                    variant="standard"
                                    label="Meta keywords"
                                />
                            </Tooltip>
                        )}
                    />
                )}
            </Grid>
        </Grid>
    )
}

export default MainInfoCard;
